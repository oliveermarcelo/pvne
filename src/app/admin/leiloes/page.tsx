import type { Metadata } from "next";
import { Plus } from "lucide-react";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { effectiveAuctionStatus } from "@/server/modules/auctions";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { AUCTION_STATUS_LABELS } from "@/lib/labels";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Leilões · Admin" };

export default async function AdminAuctionsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const now = new Date();
  const where: Prisma.AuctionWhereInput = {
    ...(sp.status === "ativos" ? { status: { in: ["ACTIVE", "SCHEDULED"] }, endsAt: { gt: now } } : sp.status && sp.status in AUCTION_STATUS_LABELS ? { status: sp.status as "ENDED" } : {}),
    ...(sp.q ? { OR: [{ listing: { card: { name: { contains: sp.q, mode: "insensitive" } } } }, { seller: { username: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auction.findMany({
      where,
      orderBy: { endsAt: "desc" },
      skip: (page - 1) * 30,
      take: 30,
      include: { listing: { select: { card: { select: { name: true } } } }, seller: { select: { username: true } }, winner: { select: { username: true } }, currentBidder: { select: { username: true } } },
    }),
    db.auction.count({ where }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Leilões" description={`${total} leilões`} actions={<LinkButton href="/admin/leiloes/novo"><Plus className="h-4 w-4" /> Criar leilão</LinkButton>} />
      <FilterBar action="/admin/leiloes">
        <input name="q" defaultValue={sp.q} placeholder="Card ou @vendedor" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-44">
          <option value="">Todos</option>
          <option value="ativos">Ao vivo / agendados</option>
          {Object.entries(AUCTION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FilterBar>
      <Table head={["Card", "Vendedor", "Status", "Lances", "Atual / final", "Líder / vencedor", "Início", "Encerramento"]} empty={rows.length === 0}>
        {rows.map((a) => {
          const st = effectiveAuctionStatus(a);
          return (
            <tr key={a.id}>
              <Td><RowLink href={`/admin/leiloes/${a.id}`}>{a.listing.card.name}</RowLink></Td>
              <Td className="text-mist-400">@{a.seller.username}</Td>
              <Td><Badge tone={st === "ACTIVE" ? "bad" : st === "SCHEDULED" ? "cyan" : st === "CANCELLED" ? "neutral" : "ok"}>{st === "ENDED_PENDING" ? "Apurando" : AUCTION_STATUS_LABELS[st]}</Badge></Td>
              <Td className="num">{a.bidCount}</Td>
              <Td className="num font-semibold text-gold-300">{formatBRL(a.currentBidCents ?? a.startingBidCents)}</Td>
              <Td className="text-mist-400">{a.winner ? `vencedor: @${a.winner.username}` : a.currentBidder ? `@${a.currentBidder.username}` : "—"}</Td>
              <Td className="text-xs text-mist-400">{formatDateTime(a.startsAt)}</Td>
              <Td className="text-xs text-mist-400">{formatDateTime(a.endsAt)}</Td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={(p) => `/admin/leiloes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} />
    </>
  );
}
