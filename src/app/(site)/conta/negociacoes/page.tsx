import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listUserNegotiations } from "@/server/modules/negotiations";
import { Row } from "@/components/account/row";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { timeAgo } from "@/lib/dates";
import { NEGOTIATION_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Negociações" };
export const dynamic = "force-dynamic";

export default async function NegotiationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage();
  const t = (await searchParams).tab;
  const tab = t === "comprando" ? "buying" : t === "vendendo" ? "selling" : "all";
  const list = await listUserNegotiations(user.id, tab);
  return (
    <>
      <PageHeader eyebrow="Negociações" title="Propostas e contrapropostas" />
      <Tabs
        active={tab}
        items={[
          { key: "all", label: "Todas", href: "/conta/negociacoes" },
          { key: "buying", label: "Comprando", href: "/conta/negociacoes?tab=comprando" },
          { key: "selling", label: "Vendendo", href: "/conta/negociacoes?tab=vendendo" },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={<Handshake className="h-6 w-6" />} title="Nenhuma negociação" description="Envie uma proposta em um card que aceita negociação, ou anuncie o seu aceitando propostas." />
      ) : (
        <div className="grid gap-3">
          {list.map((n) => {
            const iAmBuyer = n.buyerId === user.id;
            const other = iAmBuyer ? n.seller : n.buyer;
            const myTurn = n.status === "OPEN" && n.lastOfferById !== user.id;
            return (
              <Row
                key={n.id}
                href={`/conta/negociacoes/${n.id}`}
                image={n.listing.card.images[0]?.url}
                name={n.listing.card.name}
                title={n.listing.card.name}
                meta={
                  <>
                    <Badge tone={iAmBuyer ? "cyan" : "gold"}>{iAmBuyer ? "Comprando" : "Vendendo"}</Badge>
                    {n.status === "OPEN" ? (myTurn ? <Badge tone="warn">Sua vez de responder</Badge> : <Badge>Aguardando @{other.username}</Badge>) : <Badge tone={n.status === "ACCEPTED" ? "ok" : "neutral"}>{NEGOTIATION_STATUS_LABELS[n.status]}</Badge>}
                  </>
                }
                subtitle={`com @${other.username} · atualizada ${timeAgo(n.updatedAt)}`}
                right={
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-mist-500">Proposta atual</p>
                    <p className="font-display font-semibold text-gold-300 num">{formatBRL(n.currentOfferCents)}</p>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
