import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { getNegotiation } from "@/server/modules/negotiations";
import { respondNegotiationAction } from "@/app/actions/market";
import { NegotiationTimeline } from "@/components/negotiation/timeline";
import { NegotiationComposer } from "@/components/negotiation/composer";
import { CardArt } from "@/components/cards/card-art";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { NEGOTIATION_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Negociação" };
export const dynamic = "force-dynamic";

export default async function NegotiationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const n = await getNegotiation(user, id);
  if (!n || (n.buyerId !== user.id && n.sellerId !== user.id)) notFound();
  const isSeller = n.sellerId === user.id;
  const other = isSeller ? n.buyer : n.seller;
  const card = n.listing.card;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/conta/negociacoes" className="text-sm text-mist-400 hover:text-mist-200">← Negociações</Link>
          <Badge tone={n.status === "OPEN" ? "warn" : n.status === "ACCEPTED" ? "ok" : "neutral"}>{NEGOTIATION_STATUS_LABELS[n.status]}</Badge>
        </div>
        <div className="surface p-5">
          <NegotiationTimeline messages={n.messages} viewerId={user.id} />
        </div>
        {n.status === "OPEN" && (
          <div className="surface p-5">
            <NegotiationComposer action={respondNegotiationAction.bind(null, n.id)} myTurn={n.lastOfferById !== user.id} isSeller={isSeller} currentCents={n.currentOfferCents} />
          </div>
        )}
        {n.status === "ACCEPTED" && (
          <div className="surface border-ok/30 p-5">
            <p className="font-semibold text-ok">Negócio fechado por {formatBRL(n.currentOfferCents)}!</p>
            <p className="mt-1 text-sm text-mist-300">
              {isSeller ? "O comprador vai pagar via PIX pela PVNE. Avisaremos quando for a hora de enviar." : "Pague o pedido via PIX pela PVNE para garantir o card."}
            </p>
            {n.orders[0] && <LinkButton href={`/conta/pedidos/${n.orders[0].id}`} className="mt-4">Abrir pedido #{n.orders[0].code}</LinkButton>}
          </div>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Link href={`/cards/${card.id}`} className="surface block p-4 hover:border-white/15">
          <div className="mx-auto w-32"><CardArt src={card.images[0]?.url} name={card.name} color={card.category.color} category={card.category.name} /></div>
          <p className="mt-3 text-center font-semibold">{card.name}</p>
          {n.listing.priceCents && <p className="text-center text-xs text-mist-500">Anunciado por {formatBRL(n.listing.priceCents)}</p>}
        </Link>
        <div className="surface flex items-center gap-3 p-4">
          <Avatar name={other.name} src={other.avatarUrl} size={40} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-mist-500">{isSeller ? "Comprador" : "Vendedor"}</p>
            <Link href={`/colecionador/${other.username}`} className="truncate text-sm font-semibold hover:text-gold-200">@{other.username}</Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
