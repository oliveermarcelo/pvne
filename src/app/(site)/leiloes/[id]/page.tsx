import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gavel, Info } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { effectiveAuctionStatus, getAuctionPage, nextMinimumBid } from "@/server/modules/auctions";
import { isFavorite } from "@/server/modules/favorites";
import { db } from "@/server/db";
import { cancelListingAction, placeBidAction } from "@/app/actions/market";
import { AuctionPanel, type LiveState } from "@/components/auction/auction-panel";
import { CardGallery } from "@/components/cards/gallery";
import { CardDetails } from "@/components/cards/card-details";
import { FavoriteButton } from "@/components/cards/favorite-button";
import { ShareButton } from "@/components/ui/share-button";
import { SellerBox } from "@/components/market/seller-box";
import { OwnerListingControls } from "@/components/market/owner-controls";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await db.auction.findUnique({ where: { id: (await params).id }, select: { listing: { select: { card: { select: { name: true } } } } } });
  return { title: a ? `Leilão: ${a.listing.card.name}` : "Leilão" };
}

export default async function AuctionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const a = await getAuctionPage(id);
  if (!a) notFound();
  const card = a.listing.card;
  const isSeller = viewer?.id === a.sellerId;
  if ((card.status !== "ACTIVE" || a.listing.status === "BLOCKED") && !isSeller && viewer?.role !== "ADMIN" && a.status !== "ENDED") notFound();

  const fav = await isFavorite(viewer?.id, card.id);
  const initial: LiveState = {
    id: a.id,
    status: a.status,
    effectiveStatus: effectiveAuctionStatus(a),
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    startingBidCents: a.startingBidCents,
    minIncrementCents: a.minIncrementCents,
    currentBidCents: a.currentBidCents,
    nextMinimumCents: nextMinimumBid(a),
    bidCount: a.bidCount,
    currentBidder: a.currentBidder ? { username: a.currentBidder.username } : null,
    winner: a.winner ? { username: a.winner.username } : null,
    bids: a.bids.slice(0, 15).map((b) => ({ id: b.id, amountCents: b.amountCents, createdAt: b.createdAt.toISOString(), bidder: { username: b.bidder.username } })),
    serverNow: new Date().toISOString(),
  };
  const canCancel = isSeller && a.listing.status === "ACTIVE" && a.bidCount === 0 && (a.status === "ACTIVE" || a.status === "SCHEDULED");

  return (
    <div className="container py-5 sm:py-10">
      <nav className="mb-6 text-xs text-mist-500">
        <Link href="/leiloes" className="hover:text-mist-300">Leilões</Link> /{" "}
        <Link href={`/categorias/${card.category.slug}`} className="hover:text-mist-300">{card.category.name}</Link>
      </nav>
      {sp.publicado && <Alert tone="ok" className="mb-6">Leilão publicado! Compartilhe o link com a comunidade.</Alert>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <CardGallery images={card.images} name={card.name} code={card.code} color={card.category.color} category={card.category.name} />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet"><Gavel className="h-3 w-3" /> Leilão</Badge>
              {card.rarity && <Badge tone="gold">{card.rarity}</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{card.name}</h1>
            <p className="mt-2 text-sm text-mist-400">{[card.setName, card.code, card.edition].filter(Boolean).join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FavoriteButton cardId={card.id} initial={fav} loggedIn={!!viewer} count={card._count.favorites} />
              <ShareButton title={`Leilão: ${card.name} na PVNE Cards`} />
            </div>
          </div>

          <AuctionPanel
            initial={initial}
            viewer={viewer ? { username: viewer.username } : null}
            isSeller={isSeller}
            bidAction={placeBidAction.bind(null, a.id)}
            reserveCents={a.reservePriceCents}
          />

          {isSeller && (
            <OwnerListingControls
              cancelAction={cancelListingAction.bind(null, a.listingId)}
              canCancel={canCancel}
              cancelHint={a.bidCount > 0 && a.listing.status === "ACTIVE" ? "Leilões com lances não podem ser cancelados pelo vendedor. Se precisar, fale com a administração pela página de contato." : undefined}
            />
          )}

          <div className="surface p-5 text-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-mist-400" /> Regras deste leilão</h2>
            <ul className="space-y-1.5 text-mist-300">
              <li>Lance inicial: <b className="num">{formatBRL(a.startingBidCents)}</b></li>
              <li>Incremento mínimo: <b className="num">{formatBRL(a.minIncrementCents)}</b></li>
              <li>Frete: <b className="num">{a.listing.shippingCents ? formatBRL(a.listing.shippingCents) : "grátis / incluso"}</b></li>
              <li>Pagamento via PIX para a PVNE após o encerramento; o vendedor só recebe depois que você confirmar a entrega.</li>
              {a.reservePriceCents !== null && <li>Possui lance mínimo de reserva (valor sigiloso até ser atingido).</li>}
              <li>Início: {formatDateTime(a.startsAt)} · Encerramento: {formatDateTime(a.endsAt)}</li>
              <li>O maior lance válido no encerramento vence. Lances não podem ser cancelados.</li>
            </ul>
          </div>

          <SellerBox seller={a.seller} />
          <CardDetails card={card} />
        </div>
      </div>
    </div>
  );
}
