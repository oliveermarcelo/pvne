import { randomBytes } from "node:crypto";
import { db, type DbOrTx, type Tx } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError, NotFoundError } from "../errors";
import { defaultCommissionBps, loadSettings, settingInt } from "../settings";
import { isPrivateUrlOf } from "../storage";
import { lockRow, transaction } from "../tx";
import { optText, parse, text, z } from "../validation";
import { formatBRL } from "@/lib/money";
import { maskContacts } from "@/lib/contact-filter";
import { BR_STATES } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { notify, notifyAdmins } from "./notifications";
import type { OrderSource, OrderStatus } from "@/generated/prisma/enums";

/**
 * Pedido com pagamento intermediado pela plataforma:
 *
 *   AWAITING_PAYMENT ─(comprador envia comprovante)→ PAYMENT_REVIEW ─(admin confirma)→ PAID
 *   PAID ─(vendedor informa rastreio)→ SHIPPED ─(comprador confirma / prazo)→ DELIVERED
 *   DELIVERED ─(admin registra repasse)→ COMPLETED
 *   Qualquer etapa antes da entrega pode virar DISPUTED ou CANCELLED (pela administração).
 *
 * O card só muda de dono em DELIVERED. Até lá fica reservado (sem novo anúncio, sem edição).
 */

export const OPEN_ORDER_STATUSES: OrderStatus[] = ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "SHIPPED", "DISPUTED"];
const link = (id: string) => `/conta/pedidos/${id}`;

function newOrderCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function event(tx: DbOrTx, orderId: string, e: { type: "STATUS" | "MESSAGE" | "ADMIN_NOTE" | "SYSTEM"; authorId?: string | null; status?: OrderStatus; body?: string }) {
  await tx.orderEvent.create({ data: { orderId, authorId: e.authorId ?? null, type: e.type, status: e.status, body: e.body } });
}

export async function cardHasOpenOrder(client: DbOrTx, cardId: string) {
  return (await client.order.count({ where: { cardId, status: { in: OPEN_ORDER_STATUSES } } })) > 0;
}

// ─── Criação (a partir de uma venda) ──────────────────────────

/**
 * Cria o pedido quando uma venda é fechada (compra direta, proposta aceita, leilão vencido).
 * DEVE rodar dentro de uma transação com a linha do anúncio bloqueada.
 */
export async function createOrderFromSale(
  tx: Tx,
  p: { listingId: string; buyerId: string; amountCents: number; source: OrderSource; auctionId?: string; negotiationId?: string },
) {
  const listing = await tx.listing.findUniqueOrThrow({
    where: { id: p.listingId },
    include: { card: { include: { category: { select: { commissionBps: true, parent: { select: { commissionBps: true } } } } } } },
  });
  if (listing.status !== "ACTIVE") throw new DomainError("Este anúncio não está mais disponível.");
  if (listing.sellerId === p.buyerId) throw new DomainError("Você não pode comprar o próprio card.");
  const card = listing.card;
  if (card.ownerId !== listing.sellerId || card.status !== "ACTIVE") throw new DomainError("Este card não está mais disponível para venda.");

  const settings = await loadSettings(tx);
  const commissionBps = card.category.commissionBps ?? card.category.parent?.commissionBps ?? defaultCommissionBps(settings);
  const feeCents = Math.round((p.amountCents * commissionBps) / 10_000);
  const shippingCents = listing.shippingCents;
  const now = new Date();
  const deadlineHours = settingInt(settings, "payment_deadline_hours") || 48;

  await tx.listing.update({ where: { id: listing.id }, data: { status: "SOLD", closedAt: now, currentPriceCents: p.amountCents } });

  let order;
  for (let attempt = 0; ; attempt++) {
    try {
      order = await tx.order.create({
        data: {
          code: newOrderCode(),
          source: p.source,
          status: "AWAITING_PAYMENT",
          listingId: listing.id,
          cardId: card.id,
          buyerId: p.buyerId,
          sellerId: listing.sellerId,
          auctionId: p.auctionId,
          negotiationId: p.negotiationId,
          quantity: listing.quantity,
          amountCents: p.amountCents,
          shippingCents,
          totalCents: p.amountCents + shippingCents,
          commissionBps,
          feeCents,
          sellerNetCents: p.amountCents - feeCents + shippingCents,
          paymentDueAt: new Date(now.getTime() + deadlineHours * 3_600_000),
        },
      });
      break;
    } catch (e) {
      if (attempt < 3 && /orders_code_key/.test(String((e as Error).message))) continue;
      throw e;
    }
  }
  await event(tx, order.id, { type: "STATUS", status: "AWAITING_PAYMENT", body: "Pedido criado. Aguardando o pagamento do comprador." });

  // Outras negociações abertas deste anúncio são encerradas
  const others = await tx.negotiation.findMany({
    where: { listingId: listing.id, status: "OPEN", ...(p.negotiationId ? { id: { not: p.negotiationId } } : {}) },
    select: { id: true, buyerId: true },
  });
  if (others.length) {
    await tx.negotiation.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "CANCELLED", closedAt: now } });
    await tx.negotiationMessage.createMany({
      data: others.map((o) => ({ negotiationId: o.id, type: "SYSTEM" as const, body: "O card foi vendido para outro colecionador." })),
    });
    await notify(
      tx,
      others.map((o) => ({
        userId: o.buyerId,
        type: "NEGOTIATION_CANCELLED" as const,
        title: `"${card.name}" foi vendido`,
        body: "A negociação foi encerrada porque o card foi vendido.",
        link: `/conta/negociacoes/${o.id}`,
      })),
    );
  }

  await notify(tx, [
    {
      userId: p.buyerId,
      type: "ORDER_UPDATE",
      title: `Pedido ${order.code}: pague para garantir "${card.name}"`,
      body: `Total ${formatBRL(order.totalCents)} via PIX até ${deadlineHours}h. Pagamento seguro pela PVNE.`,
      link: link(order.id),
    },
    {
      userId: listing.sellerId,
      type: "ITEM_SOLD",
      title: `Você vendeu "${card.name}"`,
      body: `Pedido ${order.code} — aguardando o pagamento do comprador. Avisaremos quando for a hora de enviar.`,
      link: link(order.id),
    },
  ]);
  return { order, card };
}

/** Transfere o card ao comprador (idempotente). Chamado na confirmação de entrega. */
async function transferCard(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.buyerCardId) return order.buyerCardId;
  await lockRow(tx, "cards", order.cardId);
  const card = await tx.card.findUniqueOrThrow({ where: { id: order.cardId }, include: { images: true } });
  let buyerCardId: string;
  if (order.quantity >= card.quantity) {
    await tx.card.update({ where: { id: card.id }, data: { ownerId: order.buyerId, albumId: null } });
    buyerCardId = card.id;
  } else {
    await tx.card.update({ where: { id: card.id }, data: { quantity: { decrement: order.quantity } } });
    const clone = await tx.card.create({
      data: {
        ownerId: order.buyerId,
        categoryId: card.categoryId,
        name: card.name,
        code: card.code,
        description: card.description,
        condition: card.condition,
        edition: card.edition,
        setName: card.setName,
        language: card.language,
        rarity: card.rarity,
        quantity: order.quantity,
        originCardId: card.id,
        images: { create: card.images.map((i) => ({ url: i.url, position: i.position })) },
      },
    });
    buyerCardId = clone.id;
  }
  await tx.order.update({ where: { id: orderId }, data: { buyerCardId } });
  return buyerCardId;
}

// ─── Helpers de transição ─────────────────────────────────────

type Actor = { id: string; role: string };

async function loadLocked(tx: Tx, orderId: string) {
  await lockRow(tx, "orders", orderId);
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { card: { select: { name: true } } } });
}

function assertStatus(current: OrderStatus, allowed: OrderStatus[]) {
  if (!allowed.includes(current)) {
    throw new DomainError(`Ação indisponível: o pedido está "${ORDER_STATUS_LABELS[current]}".`);
  }
}

async function markDelivered(tx: Tx, o: { id: string; code: string; sellerId: string; buyerId: string; card: { name: string } }, actorId: string | null, note: string) {
  const now = new Date();
  await transferCard(tx, o.id);
  const seller = await tx.sellerProfile.findUnique({ where: { userId: o.sellerId }, select: { pixKey: true } });
  await tx.order.update({ where: { id: o.id }, data: { status: "DELIVERED", deliveredAt: now, payoutStatus: "PENDING", payoutPixKey: seller?.pixKey ?? null } });
  await event(tx, o.id, { type: "STATUS", status: "DELIVERED", authorId: actorId, body: note });
  await notify(tx, [
    { userId: o.sellerId, type: "ORDER_UPDATE", title: `Pedido ${o.code} entregue`, body: "O repasse do valor foi liberado e será feito pela PVNE na sua chave PIX.", link: link(o.id) },
    { userId: o.buyerId, type: "ORDER_UPDATE", title: `"${o.card.name}" está na sua coleção`, body: "Entrega confirmada. Obrigado por comprar na PVNE!", link: link(o.id) },
  ]);
  await notifyAdmins(tx, { type: "ORDER_UPDATE", title: `Repasse pendente: pedido ${o.code}`, link: `/admin/pedidos/${o.id}` });
}

// ─── Comprador ────────────────────────────────────────────────

export const addressSchema = z.object({
  shipName: text(3, 80, "Nome do destinatário"),
  shipZip: z.preprocess((v) => (typeof v === "string" ? v.replace(/\D/g, "") : v), z.string().length(8, "CEP inválido.")),
  shipStreet: text(3, 120, "Rua"),
  shipNumber: text(1, 20, "Número"),
  shipComplement: optText(60, "Complemento"),
  shipDistrict: text(2, 80, "Bairro"),
  shipCity: text(2, 80, "Cidade"),
  shipState: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.enum(BR_STATES, { errorMap: () => ({ message: "UF inválida." }) })),
});

export async function saveShippingAddress(buyerId: string, orderId: string, input: unknown) {
  const data = parse(addressSchema, input);
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    if (o.buyerId !== buyerId) throw new ForbiddenError();
    assertStatus(o.status, ["AWAITING_PAYMENT", "PAYMENT_REVIEW"]);
    await tx.order.update({ where: { id: orderId }, data: { ...data, shipComplement: data.shipComplement ?? null } });
  });
}

export async function reportPayment(buyerId: string, orderId: string, receiptUrl: unknown, ip: string | null) {
  const url = typeof receiptUrl === "string" ? receiptUrl : "";
  if (!isPrivateUrlOf(url, "receipts", buyerId)) throw new DomainError("Anexe o comprovante do PIX.", "VALIDATION", { receipt: "Anexe o comprovante." });
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    if (o.buyerId !== buyerId) throw new ForbiddenError();
    assertStatus(o.status, ["AWAITING_PAYMENT"]);
    if (!o.shipZip) throw new DomainError("Informe o endereço de entrega antes de enviar o comprovante.");
    await tx.order.update({ where: { id: orderId }, data: { status: "PAYMENT_REVIEW", paymentReceiptUrl: url, paymentReportedAt: new Date() } });
    await event(tx, orderId, { type: "STATUS", status: "PAYMENT_REVIEW", authorId: buyerId, body: "Comprador enviou o comprovante de pagamento." });
    await notifyAdmins(tx, { type: "ORDER_UPDATE", title: `Conferir pagamento: pedido ${o.code}`, body: `${formatBRL(o.totalCents)} — ${o.card.name}`, link: `/admin/pedidos/${orderId}` });
    await audit(tx, { actorId: buyerId, action: "order.payment_reported", entityType: "order", entityId: orderId, ip });
  });
}

export async function confirmDelivery(buyerId: string, orderId: string, ip: string | null) {
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    if (o.buyerId !== buyerId) throw new ForbiddenError();
    assertStatus(o.status, ["SHIPPED"]);
    await markDelivered(tx, o, buyerId, "Comprador confirmou o recebimento.");
    await audit(tx, { actorId: buyerId, action: "order.delivered", entityType: "order", entityId: orderId, ip });
  });
}

export async function openDispute(buyerId: string, orderId: string, reasonInput: unknown, ip: string | null) {
  const reason = parse(z.object({ reason: text(10, 1000, "Descrição do problema") }), { reason: reasonInput }).reason;
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    if (o.buyerId !== buyerId) throw new ForbiddenError();
    assertStatus(o.status, ["PAYMENT_REVIEW", "PAID", "SHIPPED"]);
    const clean = maskContacts(reason).text;
    await tx.order.update({ where: { id: orderId }, data: { status: "DISPUTED", disputeReason: clean } });
    await event(tx, orderId, { type: "STATUS", status: "DISPUTED", authorId: buyerId, body: `Problema relatado pelo comprador: ${clean}` });
    await notify(tx, { userId: o.sellerId, type: "ORDER_UPDATE", title: `Pedido ${o.code} em análise`, body: "O comprador relatou um problema. A equipe PVNE vai mediar.", link: link(orderId) });
    await notifyAdmins(tx, { type: "ORDER_UPDATE", title: `Disputa aberta: pedido ${o.code}`, body: clean.slice(0, 140), link: `/admin/pedidos/${orderId}` });
    await audit(tx, { actorId: buyerId, action: "order.dispute_opened", entityType: "order", entityId: orderId, ip });
  });
}

// ─── Vendedor ─────────────────────────────────────────────────

const shipSchema = z.object({ carrier: text(2, 60, "Transportadora"), trackingCode: text(4, 60, "Código de rastreio") });

export async function markShipped(sellerId: string, orderId: string, input: unknown, ip: string | null) {
  const data = parse(shipSchema, input);
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    if (o.sellerId !== sellerId) throw new ForbiddenError();
    assertStatus(o.status, ["PAID"]);
    await tx.order.update({ where: { id: orderId }, data: { status: "SHIPPED", shippedAt: new Date(), carrier: data.carrier, trackingCode: data.trackingCode } });
    await event(tx, orderId, { type: "STATUS", status: "SHIPPED", authorId: sellerId, body: `Enviado por ${data.carrier} — rastreio ${data.trackingCode}.` });
    await notify(tx, { userId: o.buyerId, type: "ORDER_UPDATE", title: `"${o.card.name}" foi enviado!`, body: `${data.carrier} · rastreio ${data.trackingCode}. Confirme quando receber.`, link: link(orderId) });
    await audit(tx, { actorId: sellerId, action: "order.shipped", entityType: "order", entityId: orderId, ip });
  });
}

// ─── Chat do pedido ───────────────────────────────────────────

export async function postOrderMessage(actor: Actor, orderId: string, bodyInput: unknown) {
  const body = parse(z.object({ body: text(1, 1000, "Mensagem") }), { body: bodyInput }).body;
  const o = await db.order.findUnique({ where: { id: orderId }, include: { card: { select: { name: true } } } });
  if (!o) throw new NotFoundError("Pedido");
  const isAdmin = actor.role === "ADMIN";
  const isParty = o.buyerId === actor.id || o.sellerId === actor.id;
  if (!isParty && !isAdmin) throw new ForbiddenError();
  const { text: clean, masked } = maskContacts(body);
  await event(db, orderId, { type: isParty ? "MESSAGE" : "ADMIN_NOTE", authorId: actor.id, body: clean });
  const recipients = [o.buyerId, o.sellerId].filter((u) => u !== actor.id);
  await notify(
    db,
    recipients.map((userId) => ({
      userId,
      type: "ORDER_MESSAGE" as const,
      title: isParty ? `Nova mensagem no pedido ${o.code}` : `Mensagem da PVNE sobre o pedido ${o.code}`,
      body: clean.slice(0, 140),
      link: link(orderId),
    })),
  );
  if (masked) await audit(db, { actorId: actor.id, action: "order.message_contact_masked", entityType: "order", entityId: orderId });
  return { masked };
}

// ─── Administração ────────────────────────────────────────────

export async function adminConfirmPayment(adminId: string, orderId: string, ip: string | null) {
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    assertStatus(o.status, ["AWAITING_PAYMENT", "PAYMENT_REVIEW"]);
    if (!o.shipZip) throw new DomainError("O comprador ainda não informou o endereço de entrega.");
    await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: new Date(), paymentConfirmedById: adminId } });
    await event(tx, orderId, { type: "STATUS", status: "PAID", authorId: adminId, body: "Pagamento confirmado pela PVNE." });
    await notify(tx, [
      { userId: o.sellerId, type: "ORDER_UPDATE", title: `Pagamento confirmado: envie "${o.card.name}"`, body: `Pedido ${o.code}. O endereço de entrega já está disponível no pedido.`, link: link(orderId) },
      { userId: o.buyerId, type: "ORDER_UPDATE", title: `Pagamento confirmado — pedido ${o.code}`, body: "O vendedor foi avisado para enviar o card.", link: link(orderId) },
    ]);
    await audit(tx, { actorId: adminId, action: "admin.order_payment_confirmed", entityType: "order", entityId: orderId, data: { total: o.totalCents }, ip });
  });
}

export async function adminRejectPayment(adminId: string, orderId: string, reasonInput: unknown, ip: string | null) {
  const reason = parse(z.object({ reason: text(3, 500, "Motivo") }), { reason: reasonInput }).reason;
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    assertStatus(o.status, ["PAYMENT_REVIEW"]);
    await tx.order.update({ where: { id: orderId }, data: { status: "AWAITING_PAYMENT", paymentReceiptUrl: null, paymentReportedAt: null } });
    await event(tx, orderId, { type: "STATUS", status: "AWAITING_PAYMENT", authorId: adminId, body: `Comprovante não aceito: ${reason}` });
    await notify(tx, { userId: o.buyerId, type: "ORDER_UPDATE", title: `Pagamento não identificado — pedido ${o.code}`, body: reason, link: link(orderId) });
    await audit(tx, { actorId: adminId, action: "admin.order_payment_rejected", entityType: "order", entityId: orderId, data: { reason }, ip });
  });
}

async function cancelInternal(tx: Tx, o: { id: string; code: string; buyerId: string; sellerId: string; status: OrderStatus; paidAt: Date | null; card: { name: string } }, actorId: string | null, reason: string, refunded: boolean) {
  const now = new Date();
  await tx.order.update({
    where: { id: o.id },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason, payoutStatus: "NOT_DUE", ...(refunded ? { refundedAt: now } : {}) },
  });
  await event(tx, o.id, { type: "STATUS", status: "CANCELLED", authorId: actorId, body: `Pedido cancelado: ${reason}${refunded ? " (valor estornado ao comprador)" : ""}` });
  await notify(tx, [
    { userId: o.buyerId, type: "ORDER_UPDATE", title: `Pedido ${o.code} cancelado`, body: reason, link: link(o.id) },
    { userId: o.sellerId, type: "ORDER_UPDATE", title: `Pedido ${o.code} cancelado`, body: `${reason} O card continua na sua coleção e pode ser anunciado de novo.`, link: link(o.id) },
  ]);
}

const cancelSchema = z.object({ reason: text(3, 500, "Motivo"), refunded: z.preprocess((v) => v === "on" || v === true, z.boolean()) });

export async function adminCancelOrder(adminId: string, orderId: string, input: unknown, ip: string | null) {
  const data = parse(cancelSchema, input);
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    assertStatus(o.status, OPEN_ORDER_STATUSES);
    if (o.paidAt && !data.refunded) throw new DomainError("Este pedido já foi pago: marque que o valor foi estornado ao comprador.");
    await cancelInternal(tx, o, adminId, data.reason, data.refunded);
    await audit(tx, { actorId: adminId, action: "admin.order_cancelled", entityType: "order", entityId: orderId, data, ip });
  });
}

/** Resolve disputa: libera para o vendedor (entregue) ou retoma o fluxo. Estorno = cancelar com estorno. */
export async function adminResolveDispute(adminId: string, orderId: string, resolution: "release" | "resume", noteInput: unknown, ip: string | null) {
  const note = parse(z.object({ note: text(3, 500, "Justificativa") }), { note: noteInput }).note;
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    assertStatus(o.status, ["DISPUTED"]);
    if (resolution === "release") {
      if (!o.paidAt) throw new DomainError("Não é possível liberar um pedido sem pagamento confirmado.");
      await markDelivered(tx, o, adminId, `Disputa resolvida a favor do vendedor: ${note}`);
    } else {
      const back: OrderStatus = o.shippedAt ? "SHIPPED" : o.paidAt ? "PAID" : o.paymentReportedAt ? "PAYMENT_REVIEW" : "AWAITING_PAYMENT";
      await tx.order.update({ where: { id: orderId }, data: { status: back } });
      await event(tx, orderId, { type: "STATUS", status: back, authorId: adminId, body: `Disputa encerrada, pedido retomado: ${note}` });
      await notify(tx, [o.buyerId, o.sellerId].map((userId) => ({ userId, type: "ORDER_UPDATE" as const, title: `Pedido ${o.code} retomado`, body: note, link: link(orderId) })));
    }
    await audit(tx, { actorId: adminId, action: `admin.order_dispute_${resolution}`, entityType: "order", entityId: orderId, data: { note }, ip });
  });
}

export async function adminRegisterPayout(adminId: string, orderId: string, referenceInput: unknown, ip: string | null) {
  const reference = parse(z.object({ reference: text(3, 120, "Identificador do PIX") }), { reference: referenceInput }).reference;
  return transaction(async (tx) => {
    const o = await loadLocked(tx, orderId);
    assertStatus(o.status, ["DELIVERED"]);
    if (o.payoutStatus !== "PENDING") throw new DomainError("Este repasse não está pendente.");
    const now = new Date();
    await tx.order.update({ where: { id: orderId }, data: { status: "COMPLETED", payoutStatus: "PAID", payoutAt: now, payoutReference: reference } });
    await event(tx, orderId, { type: "STATUS", status: "COMPLETED", authorId: adminId, body: `Repasse de ${formatBRL(o.sellerNetCents)} realizado (${reference}).` });
    await notify(tx, { userId: o.sellerId, type: "ORDER_UPDATE", title: `Repasse realizado: ${formatBRL(o.sellerNetCents)}`, body: `Pedido ${o.code} · ${reference}`, link: link(orderId) });
    await audit(tx, { actorId: adminId, action: "admin.order_payout", entityType: "order", entityId: orderId, data: { amount: o.sellerNetCents, reference }, ip });
  });
}

// ─── Rotinas automáticas (worker) ─────────────────────────────

export async function processOrders() {
  const now = new Date();
  const settings = await loadSettings();
  const autoDays = settingInt(settings, "auto_confirm_days") || 7;
  let expired = 0;
  let autoDelivered = 0;

  const overdue = await db.order.findMany({ where: { status: "AWAITING_PAYMENT", paymentDueAt: { lt: now } }, select: { id: true }, take: 200 });
  for (const { id } of overdue) {
    await transaction(async (tx) => {
      const o = await loadLocked(tx, id);
      if (o.status !== "AWAITING_PAYMENT" || !o.paymentDueAt || o.paymentDueAt >= now) return;
      await cancelInternal(tx, o, null, "Prazo de pagamento expirado.", false);
      expired++;
    }).catch((e) => console.error("[orders] expirar", id, e));
  }

  const shipped = await db.order.findMany({
    where: { status: "SHIPPED", shippedAt: { lt: new Date(now.getTime() - autoDays * 86_400_000) } },
    select: { id: true },
    take: 200,
  });
  for (const { id } of shipped) {
    await transaction(async (tx) => {
      const o = await loadLocked(tx, id);
      if (o.status !== "SHIPPED") return;
      await markDelivered(tx, o, null, `Entrega confirmada automaticamente após ${autoDays} dias do envio.`);
      autoDelivered++;
    }).catch((e) => console.error("[orders] auto-confirmar", id, e));
  }
  return { expired, autoDelivered };
}

// ─── Consultas ────────────────────────────────────────────────

export function listOrders(userId: string, role: "buyer" | "seller") {
  return db.order.findMany({
    where: role === "buyer" ? { buyerId: userId } : { sellerId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      card: { include: { images: { take: 1, orderBy: { position: "asc" } } } },
      buyer: { select: { name: true, username: true } },
      seller: { select: { name: true, username: true } },
    },
  });
}

/** Pedido para comprador, vendedor ou admin. O endereço só aparece ao vendedor após o pagamento. */
export async function getOrderForViewer(viewer: Actor, orderId: string) {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: {
      card: { include: { images: { take: 1, orderBy: { position: "asc" } }, category: true } },
      buyer: { select: { id: true, name: true, username: true, avatarUrl: true } },
      seller: { select: { id: true, name: true, username: true, avatarUrl: true } },
      events: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, username: true, role: true } } } },
    },
  });
  if (!o) return null;
  const isAdmin = viewer.role === "ADMIN";
  const role = o.buyerId === viewer.id ? "buyer" : o.sellerId === viewer.id ? "seller" : isAdmin ? "admin" : null;
  if (!role) return null;
  const addressVisible = role !== "seller" || (!!o.paidAt && o.status !== "CANCELLED");
  const safe = addressVisible
    ? o
    : { ...o, shipName: null, shipZip: null, shipStreet: null, shipNumber: null, shipComplement: null, shipDistrict: null, shipCity: null, shipState: null };
  // Comprovante: só comprador e admin
  return { ...safe, paymentReceiptUrl: role === "seller" ? null : o.paymentReceiptUrl, viewerRole: role as "buyer" | "seller" | "admin" };
}
