import { db } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError, NotFoundError } from "../errors";
import { lockRow, transaction } from "../tx";
import { money, optText, parse, text, z } from "../validation";
import { formatBRL } from "@/lib/money";
import { maskText } from "@/lib/contact-filter";
import { notify } from "./notifications";
import { createOrderFromSale } from "./orders";

/**
 * Fluxo de negociação (turnos):
 *  - comprador abre com uma proposta;
 *  - quem NÃO fez a última proposta pode aceitar, recusar ou contrapropor;
 *  - qualquer parte pode enviar mensagens ou desistir enquanto estiver aberta.
 * Toda ação vira um evento imutável em negotiation_messages.
 * Locks: listings → negotiations (mesma ordem da compra direta).
 */

const startSchema = z.object({
  amount: money("o valor da proposta"),
  message: optText(1000, "Mensagem"),
});

export async function startNegotiation(buyerId: string, listingId: string, input: unknown, ip: string | null) {
  const data = parse(startSchema, input);
  return transaction(async (tx) => {
    await lockRow(tx, "listings", listingId);
    const l = await tx.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { card: { select: { name: true, status: true } }, seller: { select: { status: true } } },
    });
    if (l.status !== "ACTIVE" || l.card.status !== "ACTIVE") throw new DomainError("Este anúncio não está mais disponível.");
    if (l.type !== "NEGOTIATION") throw new DomainError("Este anúncio não aceita propostas.");
    if (l.sellerId === buyerId) throw new DomainError("Você não pode negociar o próprio card.");
    if (l.seller.status !== "ACTIVE") throw new DomainError("O vendedor não está disponível no momento.");
    if (l.priceCents && data.amount > l.priceCents) {
      throw new DomainError("A proposta é maior que o preço anunciado — use o botão Comprar.", "VALIDATION", { amount: "Acima do preço anunciado." });
    }
    const existing = await tx.negotiation.findFirst({ where: { listingId, buyerId, status: "OPEN" }, select: { id: true } });
    if (existing) throw new DomainError("Você já tem uma negociação aberta para este card.", "EXISTS", { _id: existing.id });

    const neg = await tx.negotiation.create({
      data: {
        listingId,
        buyerId,
        sellerId: l.sellerId,
        currentOfferCents: data.amount,
        lastOfferById: buyerId,
        messages: {
          create: [
            { authorId: buyerId, type: "OFFER", amountCents: data.amount },
            ...(data.message ? [{ authorId: buyerId, type: "MESSAGE" as const, body: maskText(data.message) }] : []),
          ],
        },
      },
    });
    await notify(tx, {
      userId: l.sellerId,
      type: "OFFER_RECEIVED",
      title: `Nova proposta para "${l.card.name}"`,
      body: `Proposta de ${formatBRL(data.amount)}${l.priceCents ? ` (anunciado por ${formatBRL(l.priceCents)})` : ""}.`,
      link: `/conta/negociacoes/${neg.id}`,
    });
    await audit(tx, { actorId: buyerId, action: "negotiation.started", entityType: "negotiation", entityId: neg.id, data: { amount: data.amount }, ip });
    return neg;
  });
}

export type NegotiationAction = "accept" | "reject" | "counter" | "message" | "cancel";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("reject"), message: optText(1000, "Mensagem") }),
  z.object({ action: z.literal("counter"), amount: money("o valor"), message: optText(1000, "Mensagem") }),
  z.object({ action: z.literal("message"), message: text(1, 1000, "Mensagem") }),
  z.object({ action: z.literal("cancel"), message: optText(1000, "Mensagem") }),
]);

export async function respondNegotiation(userId: string, negotiationId: string, input: unknown, ip: string | null) {
  const data = parse(actionSchema, input);
  if ("message" in data && data.message) data.message = maskText(data.message)!;
  const pre = await db.negotiation.findUnique({ where: { id: negotiationId }, select: { listingId: true } });
  if (!pre) throw new NotFoundError("Negociação");

  return transaction(async (tx) => {
    await lockRow(tx, "listings", pre.listingId);
    await lockRow(tx, "negotiations", negotiationId);
    const n = await tx.negotiation.findUniqueOrThrow({
      where: { id: negotiationId },
      include: { listing: { include: { card: { select: { name: true } } } } },
    });
    const isBuyer = n.buyerId === userId;
    const isSeller = n.sellerId === userId;
    if (!isBuyer && !isSeller) throw new ForbiddenError();
    if (n.status !== "OPEN") throw new DomainError("Esta negociação já foi encerrada.");

    const other = isBuyer ? n.sellerId : n.buyerId;
    const cardName = n.listing.card.name;
    const link = `/conta/negociacoes/${n.id}`;
    const myTurn = n.lastOfferById !== userId;
    const now = new Date();

    switch (data.action) {
      case "accept": {
        if (!myTurn) throw new DomainError("Aguarde a resposta da outra parte à sua proposta.");
        if (n.listing.status !== "ACTIVE") throw new DomainError("O anúncio não está mais ativo.");
        const { order } = await createOrderFromSale(tx, {
          listingId: n.listingId,
          buyerId: n.buyerId,
          amountCents: n.currentOfferCents,
          source: "NEGOTIATION",
          negotiationId: n.id,
        });
        await tx.negotiation.update({ where: { id: n.id }, data: { status: "ACCEPTED", closedAt: now } });
        await tx.negotiationMessage.create({ data: { negotiationId: n.id, authorId: userId, type: "ACCEPT", amountCents: n.currentOfferCents } });
        await notify(tx, [
          {
            userId: other,
            type: "OFFER_ACCEPTED",
            title: `Proposta aceita: ${cardName}`,
            body: `Negócio fechado por ${formatBRL(n.currentOfferCents)}. Pedido ${order.code} criado — ${isSeller ? "pague via PIX para garantir o card" : "aguardando o pagamento do comprador"}.`,
            link: `/conta/pedidos/${order.id}`,
          },
        ]);
        await audit(tx, { actorId: userId, action: "negotiation.accepted", entityType: "negotiation", entityId: n.id, data: { orderId: order.id, amount: n.currentOfferCents }, ip });
        return { status: "ACCEPTED" as const, orderId: order.id };
      }
      case "reject": {
        if (!myTurn) throw new DomainError("Você não pode recusar a própria proposta. Use “Desistir”.");
        await tx.negotiation.update({ where: { id: n.id }, data: { status: "REJECTED", closedAt: now } });
        await tx.negotiationMessage.create({ data: { negotiationId: n.id, authorId: userId, type: "REJECT", amountCents: n.currentOfferCents, body: data.message } });
        await notify(tx, { userId: other, type: "OFFER_REJECTED", title: `Proposta recusada: ${cardName}`, body: data.message ?? `A proposta de ${formatBRL(n.currentOfferCents)} foi recusada.`, link });
        await audit(tx, { actorId: userId, action: "negotiation.rejected", entityType: "negotiation", entityId: n.id, ip });
        return { status: "REJECTED" as const };
      }
      case "counter": {
        if (!myTurn) throw new DomainError("Aguarde a resposta da outra parte antes de enviar outra proposta.");
        if (data.amount === n.currentOfferCents) throw new DomainError("A nova proposta deve ter um valor diferente da atual.");
        if (n.listing.priceCents && isBuyer && data.amount > n.listing.priceCents) {
          throw new DomainError("A proposta é maior que o preço anunciado.");
        }
        await tx.negotiation.update({ where: { id: n.id }, data: { currentOfferCents: data.amount, lastOfferById: userId } });
        await tx.negotiationMessage.create({
          data: { negotiationId: n.id, authorId: userId, type: isSeller ? "COUNTER_OFFER" : "OFFER", amountCents: data.amount },
        });
        if (data.message) await tx.negotiationMessage.create({ data: { negotiationId: n.id, authorId: userId, type: "MESSAGE", body: data.message } });
        await notify(tx, {
          userId: other,
          type: isSeller ? "COUNTER_OFFER" : "OFFER_RECEIVED",
          title: isSeller ? `Contraproposta para "${cardName}"` : `Nova proposta para "${cardName}"`,
          body: `Valor: ${formatBRL(data.amount)}.`,
          link,
        });
        await audit(tx, { actorId: userId, action: "negotiation.counter", entityType: "negotiation", entityId: n.id, data: { amount: data.amount }, ip });
        return { status: "OPEN" as const };
      }
      case "message": {
        await tx.negotiationMessage.create({ data: { negotiationId: n.id, authorId: userId, type: "MESSAGE", body: data.message } });
        await tx.negotiation.update({ where: { id: n.id }, data: { updatedAt: now } });
        await notify(tx, { userId: other, type: "NEGOTIATION_MESSAGE", title: `Nova mensagem sobre "${cardName}"`, body: data.message.slice(0, 140), link });
        return { status: "OPEN" as const };
      }
      case "cancel": {
        await tx.negotiation.update({ where: { id: n.id }, data: { status: "CANCELLED", closedAt: now } });
        await tx.negotiationMessage.create({ data: { negotiationId: n.id, authorId: userId, type: "CANCEL", body: data.message } });
        await notify(tx, { userId: other, type: "NEGOTIATION_CANCELLED", title: `Negociação encerrada: ${cardName}`, body: "A outra parte desistiu da negociação.", link });
        await audit(tx, { actorId: userId, action: "negotiation.cancelled", entityType: "negotiation", entityId: n.id, ip });
        return { status: "CANCELLED" as const };
      }
    }
  });
}

const negotiationInclude = {
  listing: {
    include: {
      card: { include: { images: { take: 1, orderBy: { position: "asc" as const } }, category: true } },
    },
  },
  orders: { select: { id: true, code: true, status: true } },
  buyer: { select: { id: true, name: true, username: true, avatarUrl: true } },
  seller: { select: { id: true, name: true, username: true, avatarUrl: true } },
};

export function listUserNegotiations(userId: string, role: "all" | "buying" | "selling" = "all") {
  const where =
    role === "buying" ? { buyerId: userId } : role === "selling" ? { sellerId: userId } : { OR: [{ buyerId: userId }, { sellerId: userId }] };
  return db.negotiation.findMany({ where, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: negotiationInclude });
}

/** Detalhe: apenas as partes ou a administração */
export async function getNegotiation(viewer: { id: string; role: string }, negotiationId: string) {
  const n = await db.negotiation.findUnique({
    where: { id: negotiationId },
    include: {
      ...negotiationInclude,
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, username: true, role: true } } } },
    },
  });
  if (!n) return null;
  if (n.buyerId !== viewer.id && n.sellerId !== viewer.id && viewer.role !== "ADMIN") return null;
  return n;
}

/** Intervenção administrativa: nota visível às partes e, opcionalmente, encerramento */
export async function adminIntervene(adminId: string, negotiationId: string, input: unknown, ip: string | null) {
  const data = parse(z.object({ message: text(3, 1000, "Mensagem"), close: z.preprocess((v) => v === "on", z.boolean()) }), input);
  const pre = await db.negotiation.findUnique({ where: { id: negotiationId }, select: { listingId: true } });
  if (!pre) throw new NotFoundError("Negociação");
  return transaction(async (tx) => {
    await lockRow(tx, "listings", pre.listingId);
    await lockRow(tx, "negotiations", negotiationId);
    const n = await tx.negotiation.findUniqueOrThrow({ where: { id: negotiationId }, include: { listing: { include: { card: { select: { name: true } } } } } });
    await tx.negotiationMessage.create({ data: { negotiationId, authorId: adminId, type: "ADMIN_NOTE", body: data.message } });
    if (data.close && n.status === "OPEN") {
      await tx.negotiation.update({ where: { id: negotiationId }, data: { status: "CANCELLED", closedAt: new Date() } });
      await tx.negotiationMessage.create({ data: { negotiationId, type: "SYSTEM", body: "Negociação encerrada pela administração." } });
    }
    await notify(
      tx,
      [n.buyerId, n.sellerId].map((userId) => ({
        userId,
        type: "SYSTEM" as const,
        title: `Mensagem da administração: ${n.listing.card.name}`,
        body: data.message.slice(0, 140),
        link: `/conta/negociacoes/${negotiationId}`,
      })),
    );
    await audit(tx, { actorId: adminId, action: "admin.negotiation_intervention", entityType: "negotiation", entityId: negotiationId, data: { closed: data.close }, ip });
  });
}
