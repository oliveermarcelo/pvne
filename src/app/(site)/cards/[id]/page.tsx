import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban, Pencil, ShieldCheck, Tag } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getCardPage } from "@/server/modules/cards";
import { isFavorite } from "@/server/modules/favorites";
import { db } from "@/server/db";
import { cancelListingAction, startNegotiationAction, updatePriceAction } from "@/app/actions/market";
import { CardGallery } from "@/components/cards/gallery";
import { CardDetails } from "@/components/cards/card-details";
import { FavoriteButton } from "@/components/cards/favorite-button";
import { ShareButton } from "@/components/ui/share-button";
import { SellerBox } from "@/components/market/seller-box";
import { BuyNowButton } from "@/components/market/buy-now";
import { OfferForm } from "@/components/market/offer-form";
import { OwnerListingControls } from "@/components/market/owner-controls";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { LISTING_TYPE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await db.card.findUnique({ where: { id: (await params).id }, select: { name: true, setName: true } });
  return { title: card ? `${card.name}${card.setName ? ` — ${card.setName}` : ""}` : "Card" };
}

export default async function CardPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const card = await getCardPage(id, viewer);
  if (!card) notFound();

  // Card em leilão ativo: a página do leilão é a página principal
  if (card.listing?.type === "AUCTION" && card.listing.auction) redirect(`/leiloes/${card.listing.auction.id}`);

  const listing = card.listing;
  const fav = await isFavorite(viewer?.id, card.id);
  const openNegotiation =
    viewer && listing ? await db.negotiation.findFirst({ where: { listingId: listing.id, buyerId: viewer.id, status: "OPEN" }, select: { id: true } }) : null;

  return (
    <div className="container py-5 sm:py-10">
      <nav className="mb-6 text-xs text-mist-500">
        <Link href="/marketplace" className="hover:text-mist-300">Marketplace</Link> /{" "}
        <Link href={`/categorias/${card.category.slug}`} className="hover:text-mist-300">{card.category.name}</Link>
      </nav>

      {sp.publicado && <Alert tone="ok" className="mb-6">Anúncio publicado! Ele já aparece no marketplace.</Alert>}
      {card.status === "BLOCKED" && <Alert tone="bad" className="mb-6">Este card foi bloqueado pela administração e não está visível para outros usuários.</Alert>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CardGallery images={card.images} name={card.name} code={card.code} color={card.category.color} category={card.category.name} />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {listing ? (
                <Badge tone={listing.type === "NEGOTIATION" ? "cyan" : "gold"}><Tag className="h-3 w-3" /> {LISTING_TYPE_LABELS[listing.type]}</Badge>
              ) : (
                <Badge>Na coleção · não está à venda</Badge>
              )}
              {card.rarity && <Badge tone="violet">{card.rarity}</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{card.name}</h1>
            <p className="mt-2 text-sm text-mist-400">
              {[card.setName, card.code, card.edition].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FavoriteButton cardId={card.id} initial={fav} loggedIn={!!viewer} count={card._count.favorites} />
              <ShareButton title={`${card.name} na PVNE Cards`} />
            </div>
          </div>

          {/* Painel de compra */}
          {listing && (
            <div className="surface space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-mist-500">{listing.type === "NEGOTIATION" ? "Preço de referência" : "Preço"}</p>
                <p className="font-display text-4xl font-semibold text-gold-300 num">{formatBRL(listing.priceCents)}</p>
                <p className="mt-1 text-xs text-mist-400">
                  {listing.shippingCents ? `+ frete ${formatBRL(listing.shippingCents)}` : "Frete grátis / incluso"}
                  {listing.quantity > 1 && ` · lote com ${listing.quantity} unidades`}
                </p>
                {listing.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-ink-950/50 p-3 text-sm text-mist-300">{listing.notes}</p>}
              </div>

              {card.isOwner ? (
                <OwnerListingControls
                  priceAction={updatePriceAction.bind(null, listing.id)}
                  priceCents={listing.priceCents}
                  cancelAction={cancelListingAction.bind(null, listing.id)}
                  canCancel
                />
              ) : !viewer ? (
                <LinkButton href={`/entrar?next=/cards/${card.id}`} size="lg" className="w-full">Entre para comprar ou negociar</LinkButton>
              ) : (
                <div className="grid gap-3">
                  {listing.priceCents && <BuyNowButton listingId={listing.id} priceCents={listing.priceCents} shippingCents={listing.shippingCents} />}
                  {listing.type === "NEGOTIATION" &&
                    (openNegotiation ? (
                      <LinkButton href={`/conta/negociacoes/${openNegotiation.id}`} variant="outline" size="lg" className="w-full">Ver minha negociação em andamento</LinkButton>
                    ) : (
                      <OfferForm action={startNegotiationAction.bind(null, listing.id)} referenceCents={listing.priceCents} />
                    ))}
                </div>
              )}
              <p className="flex items-start gap-2 border-t border-white/5 pt-3 text-xs text-mist-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-ok" /> Compra protegida: você paga à PVNE via PIX e o vendedor só recebe depois que você confirmar a entrega.
              </p>
            </div>
          )}

          {!listing && card.openOrder && (
            <Alert tone="info">
              Este card foi vendido e o pedido está em andamento.
              {(card.openOrder.buyerId === viewer?.id || card.openOrder.sellerId === viewer?.id) && (
                <> <Link href={`/conta/pedidos/${card.openOrder.id}`} className="link">Abrir pedido</Link></>
              )}
            </Alert>
          )}

          {card.isOwner && (
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/conta/cards/${card.id}/editar`} variant="secondary"><Pencil className="h-4 w-4" /> Editar card</LinkButton>
              {!listing && !card.openOrder && card.status === "ACTIVE" && <LinkButton href={`/conta/cards/${card.id}/anunciar`}><Tag className="h-4 w-4" /> Anunciar este card</LinkButton>}
            </div>
          )}
          {!listing && !card.isOwner && !card.openOrder && (
            <Alert tone="info"><Ban className="mr-1 inline h-4 w-4" /> Este card faz parte da coleção de @{card.owner.username} e não está à venda no momento. Favorite para acompanhar.</Alert>
          )}

          <SellerBox seller={card.owner} label={listing ? "Vendedor" : "Colecionador"} />
          <CardDetails card={card} />
        </div>
      </div>
    </div>
  );
}
