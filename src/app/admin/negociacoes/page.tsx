import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { timeAgo } from "@/lib/dates";
import { NEGOTIATION_STATUS_LABELS } from "@/lib/labels";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Negociações · Admin" };

export default async function AdminNegotiationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const where: Prisma.NegotiationWhereInput = {
    ...(sp.status && sp.status in NEGOTIATION_STATUS_LABELS ? { status: sp.status as "OPEN" } : {}),
    ...(sp.q ? { OR: [{ listing: { card: { name: { contains: sp.q, mode: "insensitive" } } } }, { buyer: { username: { contains: sp.q, mode: "insensitive" } } }, { seller: { username: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.negotiation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * 30,
      take: 30,
      include: { listing: { select: { priceCents: true, card: { select: { name: true } } } }, buyer: { select: { username: true } }, seller: { select: { username: true } }, _count: { select: { messages: true } } },
    }),
    db.negotiation.count({ where }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Negociações" description={`${total} negociações`} />
      <FilterBar action="/admin/negociacoes">
        <input name="q" defaultValue={sp.q} placeholder="Card ou @usuário" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-44">
          <option value="">Todas</option>
          {Object.entries(NEGOTIATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FilterBar>
      <Table head={["Card", "Comprador", "Vendedor", "Proposta atual", "Referência", "Eventos", "Status", "Atualizada"]} empty={rows.length === 0}>
        {rows.map((n) => (
          <tr key={n.id}>
            <Td><RowLink href={`/admin/negociacoes/${n.id}`}>{n.listing.card.name}</RowLink></Td>
            <Td className="text-mist-400">@{n.buyer.username}</Td>
            <Td className="text-mist-400">@{n.seller.username}</Td>
            <Td className="font-semibold text-gold-300 num">{formatBRL(n.currentOfferCents)}</Td>
            <Td className="num text-mist-400">{formatBRL(n.listing.priceCents)}</Td>
            <Td className="num">{n._count.messages}</Td>
            <Td><Badge tone={n.status === "OPEN" ? "warn" : n.status === "ACCEPTED" ? "ok" : "neutral"}>{NEGOTIATION_STATUS_LABELS[n.status]}</Badge></Td>
            <Td className="text-xs text-mist-400">{timeAgo(n.updatedAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={(p) => `/admin/negociacoes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} />
    </>
  );
}
