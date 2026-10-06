import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { effectiveAuctionStatus, listUserAuctions, listWonAuctions } from "@/server/modules/auctions";
import { Row } from "@/components/account/row";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Countdown } from "@/components/cards/countdown";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Meus leilões" };
export const dynamic = "force-dynamic";

export default async function MyAuctionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage();
  const tab = (await searchParams).tab === "vencidos" ? "vencidos" : "meus";
  const [mine, won] = await Promise.all([listUserAuctions(user.id), listWonAuctions(user.id)]);

  return (
    <>
      <PageHeader eyebrow="Leilões" title="Meus leilões" actions={<LinkButton href="/conta/cards?filtro=not_listed">Criar leilão</LinkButton>} />
      <Tabs
        active={tab}
        items={[
          { key: "meus", label: "Criados por mim", href: "/conta/leiloes", count: mine.length },
          { key: "vencidos", label: "Leilões vencidos", href: "/conta/leiloes?tab=vencidos", count: won.length },
        ]}
      />
      {tab === "meus" ? (
        mine.length === 0 ? (
          <EmptyState title="Você ainda não criou leilões" description="Escolha um card da coleção e selecione “Leilão” ao anunciar." />
        ) : (
          <div className="grid gap-3">
            {mine.map((a) => {
              const st = effectiveAuctionStatus(a);
              return (
                <Row
                  key={a.id}
                  href={`/leiloes/${a.id}`}
                  image={a.listing.card.images[0]?.url}
                  name={a.listing.card.name}
                  title={a.listing.card.name}
                  meta={
                    st === "ACTIVE" ? <Badge tone="bad">Ao vivo</Badge>
                    : st === "SCHEDULED" ? <Badge tone="cyan">Agendado</Badge>
                    : st === "CANCELLED" ? <Badge tone="bad">Cancelado</Badge>
                    : a.winner ? <Badge tone="ok">Vendido para @{a.winner.username}</Badge> : <Badge>Encerrado sem venda</Badge>
                  }
                  subtitle={
                    st === "ACTIVE" ? <>Termina em <Countdown to={a.endsAt} /> · {a.bidCount} lances</> : `${formatDateTime(a.startsAt)} → ${formatDateTime(a.endsAt)} · ${a.bidCount} lances`
                  }
                  right={<p className="font-display font-semibold text-gold-300 num">{formatBRL(a.currentBidCents ?? a.startingBidCents)}</p>}
                />
              );
            })}
          </div>
        )
      ) : won.length === 0 ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="Nenhum leilão vencido ainda" description="Quando você vencer um leilão, ele aparece aqui com o contato do vendedor." />
      ) : (
        <div className="grid gap-3">
          {won.map((a) => (
            <Row
              key={a.id}
              href={a.orders[0] ? `/conta/pedidos/${a.orders[0].id}` : `/leiloes/${a.id}`}
              image={a.listing.card.images[0]?.url}
              name={a.listing.card.name}
              title={a.listing.card.name}
              meta={<Badge tone="gold"><Trophy className="h-3 w-3" /> Vencido</Badge>}
              subtitle={`Vendedor @${a.seller.username}${a.orders[0] ? ` · pedido #${a.orders[0].code} — abra para pagar/acompanhar` : ""}`}
              right={<p className="font-display font-semibold text-gold-300 num">{formatBRL(a.currentBidCents)}</p>}
            />
          ))}
        </div>
      )}
    </>
  );
}
