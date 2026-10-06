import type { Metadata } from "next";
import { Crown, Gavel } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { effectiveAuctionStatus, listUserBids } from "@/server/modules/auctions";
import { Row } from "@/components/account/row";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Countdown } from "@/components/cards/countdown";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Meus lances" };
export const dynamic = "force-dynamic";

export default async function MyBidsPage() {
  const user = await requireUserPage();
  const auctions = await listUserBids(user.id);
  return (
    <>
      <PageHeader eyebrow="Leilões" title="Meus lances" description="Leilões em que você participou e a sua situação em cada um." />
      {auctions.length === 0 ? (
        <EmptyState icon={<Gavel className="h-6 w-6" />} title="Você ainda não deu lances" action={<LinkButton href="/leiloes">Ver leilões ao vivo</LinkButton>} />
      ) : (
        <div className="grid gap-3">
          {auctions.map((a) => {
            const st = effectiveAuctionStatus(a);
            const leading = a.currentBidderId === user.id;
            const my = a.bids[0]?.amountCents;
            const live = st === "ACTIVE";
            return (
              <Row
                key={a.id}
                href={`/leiloes/${a.id}`}
                image={a.listing.card.images[0]?.url}
                name={a.listing.card.name}
                title={a.listing.card.name}
                meta={
                  live ? (leading ? <Badge tone="ok"><Crown className="h-3 w-3" /> Você está na frente</Badge> : <Badge tone="bad">Lance superado</Badge>)
                  : a.winnerId === user.id ? <Badge tone="gold">Você venceu</Badge>
                  : st === "CANCELLED" ? <Badge>Cancelado</Badge> : <Badge>Encerrado</Badge>
                }
                subtitle={<>Seu maior lance: <b className="text-mist-300 num">{formatBRL(my)}</b>{live && <> · termina em <Countdown to={a.endsAt} /></>}</>}
                right={
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-mist-500">{live ? "Atual" : "Final"}</p>
                    <p className="font-display font-semibold text-gold-300 num">{formatBRL(a.currentBidCents)}</p>
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
