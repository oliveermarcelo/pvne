import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gavel, Handshake, Lock, Pencil, Tag } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getAlbumForViewer } from "@/server/modules/albums";
import { CardArt } from "@/components/cards/card-art";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getAlbumForViewer((await params).id);
  return { title: a ? `Álbum: ${a.name}` : "Álbum" };
}

export default async function AlbumPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const album = await getAlbumForViewer(id, viewer?.id);
  if (!album) notFound();

  return (
    <div className="container py-10">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{album.category.name}</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            {album.name} {album.status !== "PUBLIC" && <Badge><Lock className="h-3 w-3" /> {album.status === "PRIVATE" ? "Privado" : "Arquivado"}</Badge>}
          </h1>
          {album.description && <p className="mt-2 max-w-2xl text-sm text-mist-400">{album.description}</p>}
          <Link href={`/colecionador/${album.owner.username}`} className="mt-4 inline-flex items-center gap-2 text-sm text-mist-300 hover:text-gold-200">
            <Avatar name={album.owner.name} src={album.owner.avatarUrl} size={28} /> {album.owner.name} <span className="text-mist-500">@{album.owner.username}</span>
          </Link>
          <p className="mt-2 text-xs text-mist-500">Criado em {formatDate(album.createdAt)} · {album.cards.length} cards</p>
        </div>
        {album.isOwner && <LinkButton href={`/conta/albuns/${album.id}`} variant="secondary"><Pencil className="h-4 w-4" /> Gerenciar álbum</LinkButton>}
      </div>

      {album.cards.length === 0 ? (
        <EmptyState title="Álbum vazio" description="Nenhum card neste álbum ainda." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {album.cards.map((c) => {
            const l = c.listings[0];
            const href = l?.auction ? `/leiloes/${l.auction.id}` : `/cards/${c.id}`;
            return (
              <Link key={c.id} href={href} className="group">
                <CardArt src={c.images[0]?.url} name={c.name} code={c.code} color={c.category.color} category={c.category.name} />
                <div className="mt-2 px-0.5">
                  <p className="truncate text-sm font-medium group-hover:text-gold-200">{c.name}</p>
                  {l ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                      {l.type === "AUCTION" ? <Gavel className="h-3 w-3 text-holo-violet" /> : l.type === "NEGOTIATION" ? <Handshake className="h-3 w-3 text-holo-cyan" /> : <Tag className="h-3 w-3 text-gold-300" />}
                      <span className="font-semibold text-gold-300 num">{formatBRL(l.currentPriceCents)}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-mist-500">Na coleção</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
