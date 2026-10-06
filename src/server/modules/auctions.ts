import { db } from "../db";
import { audit } from "../audit";
import { DomainError, NotFoundError } from "../errors";
import { loadSettings, settingInt } from "../settings";
import { lockRow, transaction } from "../tx";
import { localDateTime, money, optMoney, parse, z } from "../validation";
import { formatBRL } from "@/lib/money";
import { notify } from "./notifications";
import { createOrderFromSale } from "./orders";

export const MAX_BID_CENTS = 2_000_000_000;

/** Próximo lance mínimo aceito */
export function nextMinimumBid(a: { currentBidCents: number | null; startingBidCents: number; minIncrementCents: number }) {
  return a.currentBidCents === null ? a.startingBidCents : a.currentBidCents + a.minIncrementCents;
}

/** Situação efetiva, considerando o relógio (o worker pode ainda não ter processado) */
export function effectiveAuctionStatus(a: { status: string; startsAt: Date; endsAt: Date }, now = new Date()) {
  if (a.status === "CANCELLED" || a.status === "ENDED") return a.status;
  if (now >= a.endsAt) return "ENDED_PENDING" as const;
  if (now < a.startsAt) return "SCHEDULED" as const;
  return "ACTIVE" as const;
}

// ─── Lances ───────────────────────────────────────────────────

/**
 * Registra um lance de forma segura contra concorrência:
 *  1. abre transação e bloqueia a linha do leilão (SELECT ... FOR UPDATE);
 *  2. relê o estado já bloqueado e valida todas as regras;
 *  3. insere o lance (tabela imutável; trigger revalida no banco) e atualiza o leilão.
 * Dois lances simultâneos são serializados: o segundo enxerga o primeiro e é
 * rejeitado se não superar o novo mínimo.
 */
export async function placeBid(bidderId: string, auctionId: string, amountInput: unknown, ip: string | null) {
  const amount = parse(z.object({ amount: money("o valor do lance") }), { amount: amountInput }).amount;
  const settings = await loadSettings();
  const antiSnipingMin = settingInt(settings, "auction_antisniping_minutes");

  const result = await transaction(async (tx) => {
    await lockRow(tx, "auctions", auctionId);
    const a = await tx.auction.findUniqueOrThrow({
      where: { id: auctionId },
      include: { listing: { select: { id: true, status: true, card: { select: { name: true, status: true } } } } },
    });
    const bidder = await tx.user.findUniqueOrThrow({ where: { id: bidderId }, select: { status: true } });
    const now = new Date();

    if (bidder.status !== "ACTIVE") throw new DomainError("Sua conta não pode dar lances.");
    if (a.sellerId === bidderId) throw new DomainError("Você não pode dar lance no seu próprio leilão.");
    if (a.status === "CANCELLED") throw new DomainError("Este leilão foi cancelado.");
    if (a.status === "ENDED" || now >= a.endsAt) throw new DomainError("Este leilão já foi encerrado.");
    if (now < a.startsAt) throw new DomainError("Este leilão ainda não começou.");
    if (a.listing.status !== "ACTIVE" || a.listing.card.status !== "ACTIVE") throw new DomainError("Este leilão não está disponível.");
    if (a.currentBidderId === bidderId) throw new DomainError("Você já tem o maior lance deste leilão.");

    const minimum = nextMinimumBid(a);
    if (amount < minimum) throw new DomainError(`O lance mínimo agora é ${formatBRL(minimum)}.`, "BID_TOO_LOW", { amount: `Mínimo: ${formatBRL(minimum)}` });
    if (amount > MAX_BID_CENTS) throw new DomainError("Valor de lance acima do limite permitido.");

    const bid = await tx.bid.create({ data: { auctionId, bidderId, amountCents: amount, ip, createdAt: now } });

    // Anti-sniping opcional: lance nos minutos finais prorroga o encerramento
    let endsAt = a.endsAt;
    if (antiSnipingMin > 0 && a.endsAt.getTime() - now.getTime() < antiSnipingMin * 60_000) {
      endsAt = new Date(now.getTime() + antiSnipingMin * 60_000);
    }

    await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentBidCents: amount,
        currentBidderId: bidderId,
        bidCount: { increment: 1 },
        status: "ACTIVE",
        endsAt,
      },
    });
    await tx.listing.update({ where: { id: a.listingId }, data: { currentPriceCents: amount } });

    const link = `/leiloes/${auctionId}`;
    await notify(tx, [
      {
        userId: a.sellerId,
        type: "BID_RECEIVED",
        title: `Novo lance em "${a.listing.card.name}"`,
        body: `Lance de ${formatBRL(amount)}.`,
        link,
      },
      ...(a.currentBidderId && a.currentBidderId !== bidderId
        ? [
            {
              userId: a.currentBidderId,
              type: "OUTBID" as const,
              title: `Seu lance foi superado em "${a.listing.card.name}"`,
              body: `Novo lance: ${formatBRL(amount)}. Dê um novo lance para voltar à frente.`,
              link,
            },
          ]
        : []),
    ]);
    await audit(tx, { actorId: bidderId, action: "bid.placed", entityType: "auction", entityId: auctionId, data: { bidId: bid.id, amount }, ip });

    return { bid, nextMinimum: amount + a.minIncrementCents, endsAt, extended: endsAt.getTime() !== a.endsAt.getTime() };
  });
  return result;
}

// ─── Encerramento ─────────────────────────────────────────────

/**
 * Encerra um leilão vencido (ou à força, pela administração).
 * Idempotente: pode ser chamado pelo worker, pela página e pelo admin ao mesmo tempo.
 */
export async function closeAuction(auctionId: string, opts: { force?: boolean; actorId?: string } = {}) {
  return transaction(async (tx) => {
    await lockRow(tx, "auctions", auctionId);
    const a = await tx.auction.findUniqueOrThrow({
      where: { id: auctionId },
      include: { listing: { select: { id: true, status: true, card: { select: { name: true } } } } },
    });
    const now = new Date();
    if (a.status === "ENDED" || a.status === "CANCELLED") return { closed: false as const, reason: "already_closed" };
    if (!opts.force && now < a.endsAt) return { closed: false as const, reason: "not_due" };

    const cardName = a.listing.card.name;
    const link = `/leiloes/${auctionId}`;
    const endsAt = opts.force && now < a.endsAt ? now : a.endsAt;
    await lockRow(tx, "listings", a.listingId);

    const reserveMet = a.currentBidCents !== null && (a.reservePriceCents === null || a.currentBidCents >= a.reservePriceCents);
    const hasWinner = !!a.currentBidderId && reserveMet && a.listing.status === "ACTIVE";

    const losers = await tx.bid.findMany({
      where: { auctionId, ...(a.currentBidderId ? { bidderId: { not: a.currentBidderId } } : {}) },
      distinct: ["bidderId"],
      select: { bidderId: true },
    });

    if (hasWinner) {
      const winningBid = await tx.bid.findUniqueOrThrow({
        where: { auctionId_amountCents: { auctionId, amountCents: a.currentBidCents! } },
      });
      const { order } = await createOrderFromSale(tx, {
        listingId: a.listingId,
        buyerId: a.currentBidderId!,
        amountCents: a.currentBidCents!,
        source: "AUCTION",
        auctionId,
      });
      await tx.auction.update({
        where: { id: auctionId },
        data: { status: "ENDED", closedAt: now, endsAt, winnerId: a.currentBidderId, winningBidId: winningBid.id },
      });
      await notify(tx, [
        {
          userId: a.currentBidderId!,
          type: "AUCTION_WON",
          title: `Você venceu o leilão de "${cardName}"!`,
          body: `Lance vencedor: ${formatBRL(a.currentBidCents)}. Pague o pedido ${order.code} via PIX para garantir o card.`,
          link: `/conta/pedidos/${order.id}`,
        },
        {
          userId: a.sellerId,
          type: "AUCTION_ENDED",
          title: `Seu leilão de "${cardName}" foi encerrado`,
          body: `Vendido por ${formatBRL(a.currentBidCents)} após ${a.bidCount} lance(s). Aguardando o pagamento do comprador.`,
          link: `/conta/pedidos/${order.id}`,
        },
        ...losers.map((l) => ({
          userId: l.bidderId,
          type: "AUCTION_ENDED" as const,
          title: `Leilão encerrado: ${cardName}`,
          body: `O leilão terminou em ${formatBRL(a.currentBidCents)}. Não foi dessa vez.`,
          link,
        })),
      ]);
      await audit(tx, {
        actorId: opts.actorId ?? null,
        action: opts.force ? "admin.auction_force_closed" : "auction.closed",
        entityType: "auction",
        entityId: auctionId,
        data: { winnerId: a.currentBidderId, amount: a.currentBidCents, orderId: order.id },
      });
      return { closed: true as const, winnerId: a.currentBidderId };
    }

    // Sem vencedor: sem lances ou reserva não atingida
    await tx.auction.update({ where: { id: auctionId }, data: { status: "ENDED", closedAt: now, endsAt } });
    if (a.listing.status === "ACTIVE") {
      await tx.listing.update({ where: { id: a.listingId }, data: { status: "EXPIRED", closedAt: now } });
    }
    const reason = a.currentBidCents === null ? "sem lances" : "porque o lance mínimo de reserva não foi atingido";
    await notify(tx, [
      {
        userId: a.sellerId,
        type: "AUCTION_ENDED",
        title: `Seu leilão de "${cardName}" terminou sem venda`,
        body: `Encerrado ${reason}. Você pode anunciar o card novamente.`,
        link,
      },
      ...(a.currentBidderId
        ? [
            {
              userId: a.currentBidderId,
              type: "AUCTION_ENDED" as const,
              title: `Leilão encerrado: ${cardName}`,
              body: "Seu lance foi o maior, mas não atingiu o valor mínimo de reserva do vendedor.",
              link,
            },
          ]
        : []),
      ...losers.map((l) => ({
        userId: l.bidderId,
        type: "AUCTION_ENDED" as const,
        title: `Leilão encerrado: ${cardName}`,
        body: "O leilão terminou sem venda.",
        link,
      })),
    ]);
    await audit(tx, {
      actorId: opts.actorId ?? null,
      action: opts.force ? "admin.auction_force_closed" : "auction.closed",
      entityType: "auction",
      entityId: auctionId,
      data: { winnerId: null, reason },
    });
    return { closed: true as const, winnerId: null };
  });
}

/** Chamado pelo worker a cada ciclo */
export async function processAuctions() {
  const now = new Date();
  const settings = await loadSettings();
  const soonMinutes = settingInt(settings, "auction_ending_soon_minutes");

  // 1) Agendados que já começaram
  const started = await db.auction.updateMany({
    where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } },
    data: { status: "ACTIVE" },
  });

  // 2) Vencidos → encerrar (um por transação)
  const due = await db.auction.findMany({
    where: { status: { in: ["ACTIVE", "SCHEDULED"] }, endsAt: { lte: now } },
    select: { id: true },
    orderBy: { endsAt: "asc" },
    take: 200,
  });
  let closed = 0;
  for (const { id } of due) {
    try {
      const r = await closeAuction(id);
      if (r.closed) closed++;
    } catch (e) {
      console.error(`[auctions] falha ao encerrar ${id}:`, e);
    }
  }

  // 3) "Está acabando": reivindica atomicamente para notificar uma única vez
  let endingSoon = 0;
  if (soonMinutes > 0) {
    const soon = await db.auction.findMany({
      where: { status: "ACTIVE", endingSoonNotifiedAt: null, endsAt: { gt: now, lte: new Date(now.getTime() + soonMinutes * 60_000) } },
      select: { id: true },
      take: 200,
    });
    for (const { id } of soon) {
      const claimed = await db.auction.updateMany({ where: { id, endingSoonNotifiedAt: null }, data: { endingSoonNotifiedAt: now } });
      if (claimed.count === 0) continue;
      const a = await db.auction.findUniqueOrThrow({
        where: { id },
        include: { listing: { select: { cardId: true, card: { select: { name: true } } } } },
      });
      const [bidders, favs] = await Promise.all([
        db.bid.findMany({ where: { auctionId: id }, distinct: ["bidderId"], select: { bidderId: true } }),
        db.favorite.findMany({ where: { cardId: a.listing.cardId }, select: { userId: true } }),
      ]);
      const users = new Set([...bidders.map((b) => b.bidderId), ...favs.map((f) => f.userId), a.sellerId]);
      await notify(
        db,
        [...users].map((userId) => ({
          userId,
          type: "AUCTION_ENDING_SOON" as const,
          title: `Faltam menos de ${soonMinutes} min: ${a.listing.card.name}`,
          body: a.currentBidCents ? `Lance atual: ${formatBRL(a.currentBidCents)}.` : "Ainda sem lances.",
          link: `/leiloes/${id}`,
        })),
      );
      endingSoon++;
    }
  }

  return { started: started.count, closed, endingSoon };
}

// ─── Consulta ─────────────────────────────────────────────────

export async function getAuctionPage(auctionId: string) {
  const a = await db.auction.findUnique({ where: { id: auctionId }, select: { status: true, endsAt: true } });
  if (!a) return null;
  // Encerramento "preguiçoso": se já venceu e o worker ainda não passou, encerra agora
  if ((a.status === "ACTIVE" || a.status === "SCHEDULED") && a.endsAt <= new Date()) {
    await closeAuction(auctionId).catch((e) => console.error("[auctions] lazy close", e));
  }
  return db.auction.findUnique({
    where: { id: auctionId },
    include: {
      seller: { select: { id: true, name: true, username: true, avatarUrl: true, city: true, state: true, createdAt: true } },
      winner: { select: { username: true, name: true } },
      currentBidder: { select: { username: true, name: true } },
      listing: {
        include: {
          card: {
            include: {
              images: { orderBy: { position: "asc" } },
              category: true,
              album: true,
              _count: { select: { favorites: true } },
            },
          },
        },
      },
      bids: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { bidder: { select: { username: true, name: true } } },
      },
    },
  });
}

/** Estado leve para atualização em tempo real (polling) */
export async function getAuctionLiveState(auctionId: string) {
  const a = await db.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      startingBidCents: true,
      minIncrementCents: true,
      currentBidCents: true,
      bidCount: true,
      currentBidder: { select: { username: true } },
      winner: { select: { username: true } },
      bids: { orderBy: { createdAt: "desc" }, take: 15, select: { id: true, amountCents: true, createdAt: true, bidder: { select: { username: true } } } },
    },
  });
  if (!a) throw new NotFoundError("Leilão");
  return {
    ...a,
    effectiveStatus: effectiveAuctionStatus(a),
    nextMinimumCents: nextMinimumBid(a),
    serverNow: new Date().toISOString(),
  };
}

export function listUserBids(userId: string) {
  return db.auction.findMany({
    where: { bids: { some: { bidderId: userId } } },
    orderBy: { endsAt: "desc" },
    include: {
      listing: { include: { card: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } },
      bids: { where: { bidderId: userId }, orderBy: { amountCents: "desc" }, take: 1 },
      currentBidder: { select: { username: true } },
    },
  });
}

export function listUserAuctions(sellerId: string) {
  return db.auction.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { include: { card: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } },
      currentBidder: { select: { username: true } },
      winner: { select: { username: true } },
    },
  });
}

export function listWonAuctions(userId: string) {
  return db.auction.findMany({
    where: { winnerId: userId },
    orderBy: { closedAt: "desc" },
    include: {
      listing: { include: { card: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } },
      seller: { select: { username: true, name: true } },
      orders: { select: { id: true, code: true, status: true } },
    },
  });
}

// ─── Administração ────────────────────────────────────────────

const adminAuctionSchema = z.object({
  endsAt: localDateTime("a data de encerramento"),
  minIncrement: money("o incremento mínimo"),
  startingBid: money("o lance inicial"),
  reservePrice: optMoney("O lance mínimo de reserva"),
});

export async function adminUpdateAuction(adminId: string, auctionId: string, input: unknown, ip: string | null) {
  const data = parse(adminAuctionSchema, input);
  return transaction(async (tx) => {
    await lockRow(tx, "auctions", auctionId);
    const a = await tx.auction.findUniqueOrThrow({ where: { id: auctionId } });
    if (a.status === "ENDED" || a.status === "CANCELLED") throw new DomainError("Leilão já encerrado.");
    if (data.endsAt <= new Date() || data.endsAt <= a.startsAt) throw new DomainError("A data de encerramento deve ser futura e após o início.");
    if (a.bidCount > 0 && data.startingBid !== a.startingBidCents) {
      throw new DomainError("O lance inicial não pode ser alterado depois que há lances.");
    }
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        endsAt: data.endsAt,
        minIncrementCents: data.minIncrement,
        startingBidCents: data.startingBid,
        reservePriceCents: data.reservePrice ?? null,
        endingSoonNotifiedAt: null,
      },
    });
    if (a.bidCount === 0) await tx.listing.update({ where: { id: a.listingId }, data: { currentPriceCents: data.startingBid } });
    await audit(tx, {
      actorId: adminId,
      action: "admin.auction_updated",
      entityType: "auction",
      entityId: auctionId,
      data: { before: { endsAt: a.endsAt.toISOString(), minIncrement: a.minIncrementCents }, after: { endsAt: data.endsAt.toISOString(), minIncrement: data.minIncrement } },
      ip,
    });
  });
}
