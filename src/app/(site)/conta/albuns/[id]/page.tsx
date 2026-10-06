import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getOwnedAlbum } from "@/server/modules/albums";
import { db } from "@/server/db";
import { MoveCards } from "@/components/account/move-cards";
import { PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { ALBUM_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Gerenciar álbum" };
export const dynamic = "force-dynamic";

export default async function ManageAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const album = await getOwnedAlbum(user.id, id).catch(() => null);
  if (!album) notFound();
  const include = { images: { take: 1, orderBy: { position: "asc" as const } }, category: true };
  const [inAlbum, others] = await Promise.all([
    db.card.findMany({ where: { ownerId: user.id, albumId: id, status: { not: "REMOVED" } }, include, orderBy: { createdAt: "desc" } }),
    db.card.findMany({ where: { ownerId: user.id, status: { not: "REMOVED" }, OR: [{ albumId: null }, { albumId: { not: id } }] }, include, orderBy: { createdAt: "desc" } }),
  ]);
  const map = (c: (typeof inAlbum)[number]) => ({ id: c.id, name: c.name, image: c.images[0]?.url, color: c.category.color, category: c.category.name });

  return (
    <>
      <PageHeader
        eyebrow={`Álbum · ${ALBUM_STATUS_LABELS[album.status]}`}
        title={album.name}
        description={album.description}
        actions={
          <>
            <LinkButton href={`/albuns/${album.id}`} variant="ghost"><ExternalLink className="h-4 w-4" /> Ver público</LinkButton>
            <LinkButton href={`/conta/albuns/${album.id}/editar`} variant="secondary"><Pencil className="h-4 w-4" /> Editar</LinkButton>
            <LinkButton href={`/conta/cards/novo?album=${album.id}`}><Plus className="h-4 w-4" /> Novo card aqui</LinkButton>
          </>
        }
      />
      <section className="surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Cards neste álbum ({inAlbum.length}) <span className="font-normal text-mist-500">— selecione para remover</span></h2>
        <MoveCards cards={inAlbum.map(map)} albumId={null} label="Remover do álbum" />
      </section>
      <section className="surface mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold">Adicionar cards da coleção <span className="font-normal text-mist-500">— selecione e confirme</span></h2>
        <MoveCards cards={others.map(map)} albumId={album.id} label="Adicionar ao álbum" />
      </section>
    </>
  );
}
