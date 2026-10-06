import { db } from "../db";
import { NotFoundError } from "../errors";

export async function toggleFavorite(userId: string, cardId: string) {
  const card = await db.card.findUnique({ where: { id: cardId }, select: { id: true, status: true } });
  if (!card || card.status !== "ACTIVE") throw new NotFoundError("Card");
  const existing = await db.favorite.findUnique({ where: { userId_cardId: { userId, cardId } } });
  if (existing) {
    await db.favorite.delete({ where: { userId_cardId: { userId, cardId } } });
    return false;
  }
  await db.favorite.upsert({ where: { userId_cardId: { userId, cardId } }, create: { userId, cardId }, update: {} });
  return true;
}

export async function isFavorite(userId: string | undefined | null, cardId: string) {
  if (!userId) return false;
  return !!(await db.favorite.findUnique({ where: { userId_cardId: { userId, cardId } } }));
}

export function listFavorites(userId: string) {
  return db.favorite.findMany({
    where: { userId, card: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    include: {
      card: {
        include: {
          images: { take: 1, orderBy: { position: "asc" } },
          category: true,
          owner: { select: { username: true, name: true } },
          listings: { where: { status: "ACTIVE" }, include: { auction: true } },
        },
      },
    },
  });
}
