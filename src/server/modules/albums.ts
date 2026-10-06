import { db } from "../db";
import { DomainError, NotFoundError } from "../errors";
import { id, requiredChoice, optText, optUploadUrl, parse, text, z } from "../validation";
import { assertActiveCategory } from "./categories";

export const albumSchema = z.object({
  name: text(2, 80, "Nome"),
  description: optText(1000, "Descrição"),
  coverUrl: optUploadUrl,
  categoryId: requiredChoice("Selecione a categoria."),
  status: z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]).default("PUBLIC"),
});

export function listUserAlbums(ownerId: string) {
  return db.album.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      _count: { select: { cards: { where: { status: { not: "REMOVED" } } } } },
      cards: {
        where: { status: "ACTIVE" },
        take: 3,
        orderBy: { createdAt: "desc" },
        include: { images: { take: 1, orderBy: { position: "asc" } } },
      },
    },
  });
}

export async function getOwnedAlbum(ownerId: string, albumId: string) {
  const album = await db.album.findFirst({ where: { id: albumId, ownerId } });
  if (!album) throw new NotFoundError("Álbum");
  return album;
}

export async function createAlbum(ownerId: string, input: unknown) {
  const data = parse(albumSchema, input);
  await assertActiveCategory(data.categoryId);
  return db.album.create({ data: { ...data, ownerId } });
}

export async function updateAlbum(ownerId: string, albumId: string, input: unknown) {
  const data = parse(albumSchema, input);
  await getOwnedAlbum(ownerId, albumId);
  await assertActiveCategory(data.categoryId);
  return db.album.update({
    where: { id: albumId },
    data: { ...data, description: data.description ?? null, coverUrl: data.coverUrl ?? null },
  });
}

/** Excluir o álbum não exclui os cards — eles ficam "sem álbum". */
export async function deleteAlbum(ownerId: string, albumId: string) {
  await getOwnedAlbum(ownerId, albumId);
  await db.album.delete({ where: { id: albumId } });
}

export async function setCardsAlbum(ownerId: string, cardIds: string[], albumId: string | null) {
  if (albumId) await getOwnedAlbum(ownerId, albumId);
  const res = await db.card.updateMany({
    where: { id: { in: cardIds }, ownerId, status: { not: "REMOVED" } },
    data: { albumId },
  });
  if (res.count === 0) throw new DomainError("Nenhum card seu foi encontrado para mover.");
  return res.count;
}

/** Álbum público (ou privado, se o visitante for o dono) */
export async function getAlbumForViewer(albumId: string, viewerId?: string | null) {
  const album = await db.album.findUnique({
    where: { id: albumId },
    include: {
      category: true,
      owner: { select: { id: true, name: true, username: true, avatarUrl: true, status: true, city: true, state: true } },
      cards: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
          images: { take: 1, orderBy: { position: "asc" } },
          category: true,
          listings: { where: { status: "ACTIVE" }, include: { auction: true } },
        },
      },
    },
  });
  if (!album || album.owner.status !== "ACTIVE") return null;
  const isOwner = viewerId === album.ownerId;
  if (album.status !== "PUBLIC" && !isOwner) return null;
  return { ...album, isOwner };
}
