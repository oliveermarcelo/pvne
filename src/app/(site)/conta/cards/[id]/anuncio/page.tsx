import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getOwnedCard } from "@/server/modules/cards";
import { cardHasOpenOrder } from "@/server/modules/orders";
import { db } from "@/server/db";
import { defaultCommissionBps, getSettings } from "@/server/settings";
import { updateListingAction } from "@/app/actions/market";
import { ListingForm } from "@/components/account/listing-form";
import { CardArt } from "@/components/cards/card-art";
import { Alert, PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { toLocalInput } from "@/lib/dates";
import { CONDITION_LABELS, LISTING_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Editar anúncio" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const card = await getOwnedCard(user.id, id).catch(() => null);
  if (!card || card.status !== "ACTIVE") notFound();
  const listing = card.listings[0];
  if (!listing) redirect(`/conta/cards/${card.id}/anunciar`);

  const [settings, reserved, cat, openNegotiations] = await Promise.all([
    getSettings(),
    cardHasOpenOrder(db, card.id),
    db.category.findUnique({ where: { id: card.categoryId }, select: { commissionBps: true, parent: { select: { commissionBps: true } } } }),
    db.negotiation.count({ where: { listingId: listing.id, status: "OPEN" } }),
  ]);
  const commissionBps = cat?.commissionBps ?? cat?.parent?.commissionBps ?? defaultCommissionBps(settings);
  const auction = listing.auction;
  const viewHref = auction ? `/leiloes/${auction.id}` : `/cards/${card.id}`;
  const now = new Date();

  const header = (
    <>
      <Link href={viewHref} className="mb-4 inline-flex items-center gap-1.5 text-xs text-mist-400 hover:text-gold-200"><ArrowLeft className="h-3.5 w-3.5" /> Ver anúncio</Link>
      <PageHeader eyebrow="Editar anúncio" title="Valor e forma de negociação" description="Altere o preço, troque entre venda direta, propostas e leilão, ou ajuste frete e quantidade." />
      <div className="surface mb-6 flex items-center gap-4 p-4">
        <div className="w-14 shrink-0"><CardArt src={card.images[0]?.url} name={card.name} color={card.category.color} category={card.category.name} rounded="rounded-lg" /></div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{card.name}</p>
          <p className="truncate text-xs text-mist-500">{[card.category.name, card.setName, card.code, CONDITION_LABELS[card.condition]].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-xs text-gold-300">Anúncio atual: {LISTING_TYPE_LABELS[listing.type]}</p>
        </div>
      </div>
    </>
  );

  if (reserved) {
    return (
      <>
        {header}
        <Alert tone="info">Este card tem um pedido em andamento; o anúncio não pode ser alterado até o pedido ser concluído ou cancelado.</Alert>
      </>
    );
  }
  if (auction && auction.bidCount > 0) {
    return (
      <>
        {header}
        <Alert tone="warn" className="mb-4">Este leilão já recebeu {auction.bidCount} lance(s) e não pode mais ser alterado — os lances são compromissos de compra. Se precisar, fale com a administração pela página de contato.</Alert>
        <LinkButton href={viewHref} variant="secondary">Voltar ao leilão</LinkButton>
      </>
    );
  }

  return (
    <>
      {header}
      <ListingForm
        action={updateListingAction.bind(null, listing.id)}
        maxQuantity={card.quantity}
        minStart={toLocalInput(now)}
        defaultEnd={toLocalInput(new Date(now.getTime() + 7 * 86_400_000)).slice(0, 11) + "21:00"}
        commissionBps={commissionBps}
        initial={{
          type: listing.type,
          priceCents: listing.priceCents,
          shippingCents: listing.shippingCents,
          quantity: listing.quantity,
          notes: listing.notes,
          startingBidCents: auction?.startingBidCents,
          minIncrementCents: auction?.minIncrementCents,
          reservePriceCents: auction?.reservePriceCents,
          startsAt: auction ? toLocalInput(auction.startsAt) : undefined,
          endsAt: auction ? toLocalInput(auction.endsAt) : undefined,
          started: auction ? auction.startsAt <= now : false,
          openNegotiations,
        }}
      />
    </>
  );
}
