import { db } from "../db";
import type { Prisma } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError, NotFoundError } from "../errors";
import { loadSettings, settingInt } from "../settings";
import { lockRow, transaction } from "../tx";
import { intRange, localDateTime, money, optMoney, optText, parse, z } from "../validation";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { maskText } from "@/lib/contact-filter";
import { notify } from "./notifications";
import { cardHasOpenOrder, createOrderFromSale } from "./orders";
import { canSell } from "./sellers";

// ─── Criação de anúncio ───────────────────────────────────────

const baseSchema = z.object({
  quantity: intRange(1, 999, "Quantidade").default(1),
  notes: optText(1000, "Observações"),
  // Frete fixo cobrado do comprador (vazio/0 = grátis ou incluso no preço)
  shipping: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? 0 : (parseBRLToCents(v) ?? Number.NaN)),
    z.number({ invalid_type_error: "Frete inválido." }).int().min(0, "Frete inválido.").max(100_000, "Frete acima do limite (R$ 1.000)."),
  ),
});

const saleSchema = baseSchema.extend({
  type: z.enum(["DIRECT_SALE", "NEGOTIATION"]),
  price: money("o preço"),
});

const auctionSchema = baseSchema.extend({
  type: z.literal("AUCTION"),
  startingBid: money("o lance inicial"),
  minIncrement: money("o incremento mínimo"),
  reservePrice: optMoney("O lance mínimo de reserva"),
  startsAt: z.preprocess((v) => (v === "" || v === undefined ? "now" : v), z.union([z.literal("now"), localDateTime("a data de início")])),
  endsAt: localDateTime("a data de encerramento"),
});

export const listingSchema = z.discriminatedUnion("type", [saleSchema, auctionSchema]);

type Actor = { id: string; role: string };

/**
 * Publica um anúncio para um card. O vendedor é sempre o dono do card;
 * administradores podem criar leilões em nome do dono.
 */
export async function createListing(actor: Actor, cardId: string, input: unknown, ip: string | null) {
  const data = parse(listingSchema, input);
  const settings = await loadSettings();

  return transaction(async (tx) => {
    await lockRow(tx, "cards", cardId);
    const card = await tx.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { owner: { select: { id: true, status: true, role: true, sellerStatus: true } }, listings: { where: { status: "ACTIVE" } } },
    });
    const isAdmin = actor.role === "ADMIN";
    if (card.ownerId !== actor.id && !isAdmin) throw new ForbiddenError("Este card não é seu.");
    if (card.status !== "ACTIVE") throw new DomainError("Este card não pode ser anunciado.");
    if (card.owner.status !== "ACTIVE") throw new DomainError("A conta do dono do card não está ativa.");
    if (!canSell(card.owner)) {
      throw new DomainError(
        card.ownerId === actor.id
          ? "Para anunciar é preciso ser vendedor aprovado. Envie seu pedido em “Vender na PVNE”."
          : "O dono deste card não é um vendedor aprovado.",
        "SELLER_NOT_APPROVED",
      );
    }
    if (await cardHasOpenOrder(tx, cardId)) throw new DomainError("Este card tem um pedido em andamento e não pode ser anunciado agora.");
    if (card.listings.length > 0) throw new DomainError("Este card já possui um anúncio ativo.");
    if (data.quantity > card.quantity) {
      throw new DomainError(`Você possui ${card.quantity} unidade(s) deste card.`, "VALIDATION", { quantity: "Quantidade maior que a disponível." });
    }

    if (data.type === "AUCTION") {
      const now = new Date();
      const startsAt = data.startsAt === "now" ? now : data.startsAt;
      if (startsAt.getTime() < now.getTime() - 5 * 60_000) {
        throw new DomainError("A data de início não pode estar no passado.", "VALIDATION", { startsAt: "Data no passado." });
      }
      const minHours = settingInt(settings, "auction_min_duration_hours");
      const maxDays = settingInt(settings, "auction_max_duration_days");
      const duration = data.endsAt.getTime() - startsAt.getTime();
      if (duration < minHours * 3_600_000) {
        throw new DomainError(`O leilão deve durar pelo menos ${minHours} hora(s).`, "VALIDATION", { endsAt: `Duração mínima: ${minHours}h.` });
      }
      if (duration > maxDays * 86_400_000) {
        throw new DomainError(`O leilão pode durar no máximo ${maxDays} dias.`, "VALIDATION", { endsAt: `Duração máxima: ${maxDays} dias.` });
      }
      if (data.reservePrice && data.reservePrice < data.startingBid) {
        throw new DomainError("O lance mínimo de reserva não pode ser menor que o lance inicial.", "VALIDATION", {
          reservePrice: "Deve ser maior ou igual ao lance inicial.",
        });
      }
      const listing = await tx.listing.create({
        data: {
          cardId,
          sellerId: card.ownerId,
          type: "AUCTION",
          quantity: data.quantity,
          notes: maskText(data.notes),
          shippingCents: data.shipping,
          currentPriceCents: data.startingBid,
          auction: {
            create: {
              sellerId: card.ownerId,
              startingBidCents: data.startingBid,
              minIncrementCents: data.minIncrement,
              reservePriceCents: data.reservePrice ?? null,
              startsAt,
              endsAt: data.endsAt,
              status: startsAt <= now ? "ACTIVE" : "SCHEDULED",
            },
          },
        },
        include: { auction: true },
      });
      await audit(tx, {
        actorId: actor.id,
        action: isAdmin && actor.id !== card.ownerId ? "admin.auction_created" : "auction.created",
        entityType: "auction",
        entityId: listing.auction!.id,
        data: { cardId, startingBid: data.startingBid, endsAt: data.endsAt.toISOString() },
        ip,
      });
      return { id: listing.id, type: listing.type, cardId, auctionId: listing.auction!.id };
    }

    const listing = await tx.listing.create({
      data: {
        cardId,
        sellerId: card.ownerId,
        type: data.type,
        priceCents: data.price,
        currentPriceCents: data.price,
        quantity: data.quantity,
        notes: maskText(data.notes),
        shippingCents: data.shipping,
      },
    });
    await audit(tx, { actorId: actor.id, action: "listing.created", entityType: "listing", entityId: listing.id, data: { type: data.type, price: data.price }, ip });
    return { id: listing.id, type: listing.type, cardId, auctionId: null as string | null };
  });
}

/** Altera o preço de uma venda direta / negociação ativa */
export async function updateListingPrice(userId: string, listingId: string, priceInput: unknown) {
  const price = parse(z.object({ price: money("o preço") }), { price: priceInput }).price;
  return transaction(async (tx) => {
    await lockRow(tx, "listings", listingId);
    const l = await tx.listing.findUniqueOrThrow({ where: { id: listingId } });
    if (l.sellerId !== userId) throw new ForbiddenError();
    if (l.status !== "ACTIVE" || l.type === "AUCTION") throw new DomainError("Só é possível alterar o preço de vendas ativas.");
    await tx.listing.update({ where: { id: listingId }, data: { priceCents: price, currentPriceCents: price } });
  });
}

/**
 * Encerra um anúncio (vendedor ou administração).
 * Leilão com lances só pode ser cancelado pela administração.
 */
export async function cancelListing(actor: Actor, listingId: string, reason?: string, finalStatus: "CANCELLED" | "BLOCKED" = "CANCELLED") {
  const isAdmin = actor.role === "ADMIN";
  const pre = await db.listing.findUnique({ where: { id: listingId }, include: { auction: { select: { id: true } } } });
  if (!pre) throw new NotFoundError("Anúncio");

  return transaction(async (tx) => {
    // Ordem de lock: auctions → listings
    if (pre.auction) await lockRow(tx, "auctions", pre.auction.id);
    await lockRow(tx, "listings", listingId);
    const l = await tx.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { card: { select: { name: true } }, auction: true },
    });
    if (l.sellerId !== actor.id && !isAdmin) throw new ForbiddenError();
    if (l.status !== "ACTIVE") throw new DomainError("Este anúncio já foi encerrado.");
    if (l.auction && l.auction.bidCount > 0 && !isAdmin) {
      throw new DomainError("Leilões com lances não podem ser cancelados pelo vendedor. Fale com a administração.");
    }
    const now = new Date();
    await tx.listing.update({
      where: { id: listingId },
      data: { status: finalStatus, closedAt: now, blockedReason: finalStatus === "BLOCKED" ? (reason ?? null) : null },
    });

    if (l.auction) {
      await tx.auction.update({ where: { id: l.auction.id }, data: { status: "CANCELLED", closedAt: now, cancelReason: reason ?? null } });
      const bidders = await tx.bid.findMany({ where: { auctionId: l.auction.id }, distinct: ["bidderId"], select: { bidderId: true } });
      await notify(
        tx,
        bidders.map((b) => ({
          userId: b.bidderId,
          type: "AUCTION_CANCELLED" as const,
          title: `Leilão cancelado: ${l.card.name}`,
          body: reason ?? "O leilão foi cancelado.",
          link: `/leiloes/${l.auction!.id}`,
        })),
      );
      if (isAdmin && l.sellerId !== actor.id) {
        await notify(tx, {
          userId: l.sellerId,
          type: "AUCTION_CANCELLED",
          title: `Seu leilão foi cancelado: ${l.card.name}`,
          body: reason ?? "Cancelado pela administração.",
          link: `/leiloes/${l.auction.id}`,
        });
      }
    }

    const openNegs = await tx.negotiation.findMany({ where: { listingId, status: "OPEN" }, select: { id: true, buyerId: true } });
    if (openNegs.length) {
      await tx.negotiation.updateMany({ where: { id: { in: openNegs.map((n) => n.id) } }, data: { status: "CANCELLED", closedAt: now } });
      await tx.negotiationMessage.createMany({
        data: openNegs.map((n) => ({ negotiationId: n.id, type: "SYSTEM" as const, body: "O anúncio foi encerrado pelo vendedor." })),
      });
      await notify(
        tx,
        openNegs.map((n) => ({
          userId: n.buyerId,
          type: "NEGOTIATION_CANCELLED" as const,
          title: `Anúncio encerrado: ${l.card.name}`,
          body: "A negociação foi encerrada porque o anúncio saiu do ar.",
          link: `/conta/negociacoes/${n.id}`,
        })),
      );
    }

    if (isAdmin && l.sellerId !== actor.id && !l.auction) {
      await notify(tx, {
        userId: l.sellerId,
        type: "SYSTEM",
        title: finalStatus === "BLOCKED" ? `Anúncio bloqueado: ${l.card.name}` : `Anúncio encerrado: ${l.card.name}`,
        body: reason ?? undefined,
        link: `/cards/${l.cardId}`,
      });
    }

    await audit(tx, {
      actorId: actor.id,
      action: isAdmin && l.sellerId !== actor.id ? `admin.listing_${finalStatus.toLowerCase()}` : "listing.cancelled",
      entityType: "listing",
      entityId: listingId,
      data: { reason: reason ?? null },
    });
  });
}

// ─── Compra direta ────────────────────────────────────────────

/**
 * Compra pelo preço anunciado. expectedPriceCents protege contra o vendedor
 * alterar o preço entre o comprador abrir a página e confirmar.
 */
export async function buyNow(buyerId: string, listingId: string, expectedPriceCents: number, ip: string | null) {
  return transaction(async (tx) => {
    await lockRow(tx, "listings", listingId);
    const l = await tx.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { card: { select: { name: true } }, seller: { select: { status: true } } },
    });
    if (l.status !== "ACTIVE") throw new DomainError("Este anúncio não está mais disponível.");
    if (l.type === "AUCTION" || !l.priceCents) throw new DomainError("Este card não está à venda por preço fixo.");
    if (l.sellerId === buyerId) throw new DomainError("Você não pode comprar o próprio card.");
    if (l.seller.status !== "ACTIVE") throw new DomainError("O vendedor não está disponível no momento.");
    if (l.priceCents !== expectedPriceCents) {
      throw new DomainError(`O preço foi alterado para ${formatBRL(l.priceCents)}. Confira e confirme novamente.`);
    }

    const { order } = await createOrderFromSale(tx, { listingId, buyerId, amountCents: l.priceCents, source: "DIRECT_SALE" });

    await audit(tx, { actorId: buyerId, action: "order.direct_purchase", entityType: "order", entityId: order.id, data: { listingId, amount: l.priceCents }, ip });
    return order;
  });
}

// ─── Busca do marketplace ─────────────────────────────────────

export type MarketFilters = {
  q?: string;
  category?: string; // slug
  album?: string;
  condition?: string;
  type?: string; // DIRECT_SALE | NEGOTIATION | AUCTION
  min?: number; // centavos
  max?: number;
  seller?: string; // username
  phase?: "live" | "scheduled"; // só leilões: em andamento ou agendados
  sort?: "recent" | "price_asc" | "price_desc" | "ending";
  page?: number;
  perPage?: number;
};

const CONDITIONS = ["NEW", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR"] as const;
const TYPES = ["DIRECT_SALE", "NEGOTIATION", "AUCTION"] as const;

export const listingCardInclude = {
  auction: { select: { id: true, endsAt: true, startsAt: true, status: true, bidCount: true, currentBidCents: true, startingBidCents: true } },
  seller: { select: { username: true, name: true, avatarUrl: true } },
  card: {
    select: {
      id: true,
      name: true,
      code: true,
      condition: true,
      rarity: true,
      setName: true,
      images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
      category: { select: { name: true, slug: true, color: true } },
    },
  },
} satisfies Prisma.ListingInclude;

export async function searchMarketplace(f: MarketFilters) {
  const perPage = f.perPage ?? 24;
  const page = f.page ?? 1;
  const now = new Date();

  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    seller: { status: "ACTIVE" },
    card: { status: "ACTIVE" },
    // Leilões encerrados (mas ainda não processados pelo worker) não aparecem
    OR: [{ type: { not: "AUCTION" } }, { auction: { endsAt: { gt: now }, status: { in: ["ACTIVE", "SCHEDULED"] } } }],
  };
  const and: Prisma.ListingWhereInput[] = [];

  if (f.q?.trim()) {
    const q = f.q.trim().slice(0, 80);
    and.push({
      card: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { setName: { contains: q, mode: "insensitive" } },
          { rarity: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }
  if (f.category) {
    const cat = await db.category.findFirst({ where: { slug: f.category }, include: { children: { select: { id: true } } } });
    const ids = cat ? [cat.id, ...cat.children.map((c) => c.id)] : ["__none__"];
    and.push({ card: { categoryId: { in: ids } } });
  }
  if (f.album) and.push({ card: { albumId: f.album } });
  if (f.condition && (CONDITIONS as readonly string[]).includes(f.condition)) {
    and.push({ card: { condition: f.condition as (typeof CONDITIONS)[number] } });
  }
  if (f.type && (TYPES as readonly string[]).includes(f.type)) and.push({ type: f.type as (typeof TYPES)[number] });
  if (f.min) and.push({ currentPriceCents: { gte: f.min } });
  if (f.max) and.push({ currentPriceCents: { lte: f.max } });
  if (f.phase === "live") and.push({ type: "AUCTION", auction: { startsAt: { lte: now } } });
  if (f.phase === "scheduled") and.push({ type: "AUCTION", auction: { startsAt: { gt: now } } });
  if (f.seller) and.push({ seller: { username: f.seller.toLowerCase() } });
  if (and.length) where.AND = and;

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    f.sort === "price_asc"
      ? [{ currentPriceCents: "asc" }]
      : f.sort === "price_desc"
        ? [{ currentPriceCents: "desc" }]
        : f.sort === "ending"
          ? [{ auction: { endsAt: "asc" } }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];

  const [items, total] = await Promise.all([
    db.listing.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage, include: listingCardInclude }),
    db.listing.count({ where }),
  ]);
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export type ListingCardData = Awaited<ReturnType<typeof searchMarketplace>>["items"][number];
