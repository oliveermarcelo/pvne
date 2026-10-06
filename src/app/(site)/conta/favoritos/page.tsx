import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listFavorites } from "@/server/modules/favorites";
import { CardArt } from "@/components/cards/card-art";
import { FavoriteButton } from "@/components/cards/favorite-button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { LISTING_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Meus favoritos" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUserPage();
  const favs = await listFavorites(user.id);
  return (
    <>
      <PageHeader eyebrow="Coleção dos sonhos" title="Meus favoritos" description="Cards que você está de olho. Avisamos quando um leilão favoritado estiver acabando." />
      {favs.length === 0 ? (
        <EmptyState icon={<Heart className="h-6 w-6" />} title="Nenhum favorito ainda" description="Toque no coração de um card para acompanhá-lo aqui." action={<LinkButton href="/marketplace">Explorar marketplace</LinkButton>} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {favs.map(({ card }) => {
            const l = card.listings[0];
            return (
              <div key={card.id} className="surface p-2.5">
                <Link href={l?.auction ? `/leiloes/${l.auction.id}` : `/cards/${card.id}`} className="group block">
                  <CardArt src={card.images[0]?.url} name={card.name} code={card.code} color={card.category.color} category={card.category.name} />
                  <p className="mt-2 truncate px-1 text-sm font-semibold group-hover:text-gold-200">{card.name}</p>
                </Link>
                <div className="flex items-center justify-between gap-2 px-1 pt-1">
                  <div className="min-w-0 text-xs">
                    {l ? (
                      <>
                        <span className="text-mist-500">{LISTING_TYPE_LABELS[l.type]}</span>
                        <p className="font-semibold text-gold-300 num">{formatBRL(l.currentPriceCents)}</p>
                      </>
                    ) : (
                      <span className="text-mist-500">Não está à venda</span>
                    )}
                  </div>
                  <FavoriteButton cardId={card.id} initial loggedIn count={undefined} className="px-2" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
