import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listUserAlbums } from "@/server/modules/albums";
import { CardArt } from "@/components/cards/card-art";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ALBUM_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Meus álbuns" };
export const dynamic = "force-dynamic";

export default async function AlbumsPage() {
  const user = await requireUserPage();
  const albums = await listUserAlbums(user.id);
  return (
    <>
      <PageHeader eyebrow="Coleção" title="Meus álbuns" description="Organize seus cards por jogo, coleção ou do jeito que preferir." actions={<LinkButton href="/conta/albuns/novo"><Plus className="h-4 w-4" /> Novo álbum</LinkButton>} />
      {albums.length === 0 ? (
        <EmptyState title="Você ainda não tem álbuns" description="Crie seu primeiro álbum para organizar a coleção." action={<LinkButton href="/conta/albuns/novo">Criar álbum</LinkButton>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {albums.map((a) => (
            <Link key={a.id} href={`/conta/albuns/${a.id}`} className="group surface p-4 transition hover:border-white/15">
              <div className="relative flex h-40 items-center justify-center gap-0">
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : a.cards.length ? (
                  a.cards.map((c, i) => (
                    <div key={c.id} className="w-24" style={{ transform: `rotate(${(i - (a.cards.length - 1) / 2) * 9}deg)`, marginLeft: i ? -36 : 0, zIndex: i }}>
                      <CardArt src={c.images[0]?.url} name={c.name} color={a.category.color} category={a.category.name} rounded="rounded-lg" />
                    </div>
                  ))
                ) : (
                  <div className="w-24"><CardArt name={a.name} color={a.category.color} category={a.category.name} rounded="rounded-lg" /></div>
                )}
              </div>
              <div className="mt-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-mist-500">{a.category.name}</p>
                  <h2 className="truncate font-semibold group-hover:text-gold-200">{a.name}</h2>
                  <p className="text-xs text-mist-500 num">{a._count.cards} cards</p>
                </div>
                {a.status !== "PUBLIC" && <Badge><Lock className="h-3 w-3" /> {ALBUM_STATUS_LABELS[a.status]}</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
