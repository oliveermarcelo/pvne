import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { getOwnedCard } from "@/server/modules/cards";
import { cardHasOpenOrder } from "@/server/modules/orders";
import { canSell } from "@/server/modules/sellers";
import { db } from "@/server/db";
import { defaultCommissionBps, getSettings } from "@/server/settings";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { createListingAction } from "@/app/actions/market";
import { ListingForm } from "@/components/account/listing-form";
import { CardArt } from "@/components/cards/card-art";
import { PageHeader } from "@/components/ui/misc";
import { toLocalInput } from "@/lib/dates";
import { CONDITION_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Anunciar card" };

export default async function ListCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const sp = await searchParams;
  const card = await getOwnedCard(user.id, id).catch(() => null);
  if (!card || card.status !== "ACTIVE") notFound();
  if (card.listings.length) redirect(`/cards/${card.id}`);
  const [me, settings, reserved, cat] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true, sellerStatus: true } }),
    getSettings(),
    cardHasOpenOrder(db, card.id),
    db.category.findUnique({ where: { id: card.categoryId }, select: { commissionBps: true, parent: { select: { commissionBps: true } } } }),
  ]);
  const commissionBps = cat?.commissionBps ?? cat?.parent?.commissionBps ?? defaultCommissionBps(settings);

  if (!canSell(me)) {
    return (
      <>
        <PageHeader eyebrow="Anunciar" title="Torne-se um vendedor PVNE" />
        <Alert tone={me.sellerStatus === "PENDING" ? "info" : "warn"} className="mb-6">
          {me.sellerStatus === "PENDING"
            ? "Seu pedido para vender está em análise. Assim que for aprovado, você poderá anunciar este card."
            : me.sellerStatus === "SUSPENDED"
              ? "Sua habilitação de vendedor está suspensa."
              : "Para anunciar é preciso passar por uma verificação rápida (dados, chave PIX e documento com foto). Comprar e dar lances continua liberado."}
        </Alert>
        {me.sellerStatus !== "PENDING" && me.sellerStatus !== "SUSPENDED" && <LinkButton href="/conta/vender">Quero vender na PVNE</LinkButton>}
      </>
    );
  }
  if (reserved) {
    return (
      <>
        <PageHeader eyebrow="Anunciar" title={card.name} />
        <Alert tone="info">Este card tem um pedido em andamento e só poderá ser anunciado se o pedido for cancelado.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Anunciar" title="Como você quer negociar este card?" />
      <div className="mb-6 flex items-center gap-4 surface p-4">
        <div className="w-14 shrink-0"><CardArt src={card.images[0]?.url} name={card.name} color={card.category.color} category={card.category.name} rounded="rounded-lg" /></div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{card.name}</p>
          <p className="truncate text-xs text-mist-500">{[card.category.name, card.setName, card.code, CONDITION_LABELS[card.condition]].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <ListingForm action={createListingAction.bind(null, card.id)} maxQuantity={card.quantity} defaultType={sp.tipo === "leilao" ? "AUCTION" : "DIRECT_SALE"} minStart={toLocalInput(new Date())} defaultEnd={toLocalInput(new Date(Date.now() + 7 * 86_400_000)).slice(0, 11) + "21:00"} commissionBps={commissionBps} />
    </>
  );
}
