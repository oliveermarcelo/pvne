import { db } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError, NotFoundError } from "../errors";
import { id, intRange, optId, optText, parse, text, uploadUrl, z } from "../validation";
import { assertActiveCategory } from "./categories";
import { getOwnedAlbum } from "./albums";
import { cardHasOpenOrder } from "./orders";
import { maskText } from "@/lib/contact-filter";

export const MAX_CARD_IMAGES = 6;

export const cardSchema = z.object({
  name: text(2, 120, "Nome do card"),
  code: optText(40, "Código"),
  categoryId: id,
  albumId: optId,
  description: optText(3000, "Descrição"),
  condition: z.enum(["NEW", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR"], {
    errorMap: () => ({ message: "Selecione o estado de conservação." }),
  }),
  edition: optText(80, "Edição"),
  setName: optText(120, "Coleção/expansão"),
  language: optText(40, "Idioma"),
  rarity: optText(60, "Raridade"),
  quantity: intRange(1, 999, "Quantidade").default(1),
  images: z.array(uploadUrl).max(MAX_CARD_IMAGES, `Envie no máximo ${MAX_CARD_IMAGES} imagens.`).default([]),
});

export type CardInput = z.infer<typeof cardSchema>;

const cardInclude = {
  images: { orderBy: { position: "asc" as const } },
  category: true,
  album: true,
  listings: { where: { status: "ACTIVE" as const }, include: { auction: true } },
};

export async function createCard(ownerId: string, input: unknown) {
  const data = parse(cardSchema, input);
  await assertActiveCategory(data.categoryId);
  if (data.albumId) await getOwnedAlbum(ownerId, data.albumId);
  const { images, ...fields } = data;
  const card = await db.card.create({
    data: {
      ...fields,
      description: maskText(fields.description),
      ownerId,
      images: { create: images.map((url, position) => ({ url, position })) },
    },
  });
  return card;
}

export async function getOwnedCard(ownerId: string, cardId: string) {
  const card = await db.card.findFirst({ where: { id: cardId, ownerId, status: { not: "REMOVED" } }, include: cardInclude });
  if (!card) throw new NotFoundError("Card");
  return card;
}

export async function updateCard(ownerId: string, cardId: string, input: unknown) {
  const data = parse(cardSchema, input);
  const card = await getOwnedCard(ownerId, cardId);
  if (card.status === "BLOCKED") throw new ForbiddenError("Este card foi bloqueado pela administração e não pode ser editado.");

  const active = card.listings[0];
  if (active?.type === "AUCTION" && active.auction && active.auction.bidCount > 0) {
    throw new DomainError("Este card está em um leilão com lances e não pode ser alterado até o encerramento.");
  }
  if (await cardHasOpenOrder(db, cardId)) throw new DomainError("Este card tem um pedido em andamento e não pode ser alterado até a conclusão.");
  if (active && data.quantity < active.quantity) {
    throw new DomainError(`Há um anúncio ativo com ${active.quantity} unidade(s). A quantidade não pode ser menor.`);
  }
  await assertActiveCategory(data.categoryId);
  if (data.albumId) await getOwnedAlbum(ownerId, data.albumId);

  const { images, ...fields } = data;
  await db.$transaction([
    db.card.update({
      where: { id: cardId },
      data: {
        ...fields,
        albumId: fields.albumId ?? null,
        code: fields.code ?? null,
        description: maskText(fields.description) ?? null,
        edition: fields.edition ?? null,
        setName: fields.setName ?? null,
        language: fields.language ?? null,
        rarity: fields.rarity ?? null,
      },
    }),
    db.cardImage.deleteMany({ where: { cardId } }),
    db.cardImage.createMany({ data: images.map((url, position) => ({ cardId, url, position })) }),
  ]);
}

/** Remove o card da coleção. Se já teve anúncios/pedidos, é removido logicamente (histórico preservado). */
export async function deleteCard(ownerId: string, cardId: string) {
  const card = await getOwnedCard(ownerId, cardId);
  if (card.listings.length > 0) throw new DomainError("Encerre o anúncio ativo deste card antes de excluí-lo.");
  if (await cardHasOpenOrder(db, cardId)) throw new DomainError("Este card tem um pedido em andamento.");
  const history = await db.listing.count({ where: { cardId } });
  if (history > 0) {
    await db.card.update({ where: { id: cardId }, data: { status: "REMOVED", albumId: null } });
  } else {
    await db.card.delete({ where: { id: cardId } });
  }
}

/** Página pública do card */
export async function getCardPage(cardId: string, viewer?: { id: string; role: string } | null) {
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: {
      images: { orderBy: { position: "asc" } },
      category: { include: { parent: true } },
      album: true,
      owner: { select: { id: true, name: true, username: true, avatarUrl: true, city: true, state: true, createdAt: true, status: true } },
      listings: {
        where: { status: "ACTIVE" },
        include: {
          auction: {
            include: {
              bids: {
                orderBy: { createdAt: "desc" },
                take: 30,
                include: { bidder: { select: { username: true, name: true } } },
              },
            },
          },
        },
      },
      _count: { select: { favorites: true } },
    },
  });
  if (!card || card.status === "REMOVED") return null;
  const isOwner = viewer?.id === card.ownerId;
  const isAdmin = viewer?.role === "ADMIN";
  if ((card.status === "BLOCKED" || card.owner.status !== "ACTIVE") && !isOwner && !isAdmin) return null;
  const openOrder = await db.order.findFirst({ where: { cardId, status: { in: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "SHIPPED", "DISPUTED"] } }, select: { id: true, buyerId: true, sellerId: true } });
  return { ...card, listing: card.listings[0] ?? null, isOwner, openOrder };
}

/** Painel "Meus cards" com filtros por situação */
export type MyCardsFilter = "all" | "for_sale" | "negotiation" | "auction" | "not_listed";

export function listMyCards(ownerId: string, filter: MyCardsFilter = "all", albumId?: string) {
  const listingWhere =
    filter === "for_sale"
      ? { some: { status: "ACTIVE" as const, type: "DIRECT_SALE" as const } }
      : filter === "negotiation"
        ? { some: { status: "ACTIVE" as const, type: "NEGOTIATION" as const } }
        : filter === "auction"
          ? { some: { status: "ACTIVE" as const, type: "AUCTION" as const } }
          : filter === "not_listed"
            ? { none: { status: "ACTIVE" as const } }
            : undefined;
  return db.card.findMany({
    where: {
      ownerId,
      status: { not: "REMOVED" },
      ...(albumId ? { albumId } : {}),
      ...(listingWhere ? { listings: listingWhere } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: cardInclude,
  });
}

// ─── Administração ────────────────────────────────────────────

export async function adminSetCardStatus(adminId: string, cardId: string, status: "ACTIVE" | "BLOCKED" | "REMOVED", reason: string | null, ip: string | null) {
  const card = await db.card.findUnique({ where: { id: cardId }, include: { listings: { where: { status: "ACTIVE" } } } });
  if (!card) throw new NotFoundError("Card");
  if (status !== "ACTIVE") {
    const { cancelListing } = await import("./listings");
    for (const l of card.listings) {
      await cancelListing({ id: adminId, role: "ADMIN" }, l.id, reason ?? "Anúncio bloqueado pela administração.", "BLOCKED");
    }
  }
  await db.card.update({ where: { id: cardId }, data: { status } });
  await audit(db, { actorId: adminId, action: `admin.card_${status.toLowerCase()}`, entityType: "card", entityId: cardId, data: { reason }, ip });
}

const adminCardSchema = cardSchema.omit({ albumId: true, images: true });

export async function adminUpdateCard(adminId: string, cardId: string, input: unknown, ip: string | null) {
  const data = parse(adminCardSchema, input);
  await assertActiveCategory(data.categoryId);
  await db.card.update({
    where: { id: cardId },
    data: {
      ...data,
      code: data.code ?? null,
      description: data.description ?? null,
      edition: data.edition ?? null,
      setName: data.setName ?? null,
      language: data.language ?? null,
      rarity: data.rarity ?? null,
    },
  });
  await audit(db, { actorId: adminId, action: "admin.card_updated", entityType: "card", entityId: cardId, ip });
}
