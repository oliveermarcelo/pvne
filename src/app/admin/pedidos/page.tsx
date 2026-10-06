import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { PageHeader, Pagination, Stat } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/labels";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedidos · Admin" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const where: Prisma.OrderWhereInput = {
    ...(sp.status === "acao"
      ? { status: { in: ["PAYMENT_REVIEW", "DISPUTED"] } }
      : sp.status && sp.status in ORDER_STATUS_LABELS
        ? { status: sp.status as "PAID" }
        : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q.toUpperCase() } }, { card: { name: { contains: sp.q, mode: "insensitive" } } }, { buyer: { username: { contains: sp.q, mode: "insensitive" } } }, { seller: { username: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total, review, disputes, revenue] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 30,
      take: 30,
      include: { card: { select: { name: true } }, buyer: { select: { username: true } }, seller: { select: { username: true } } },
    }),
    db.order.count({ where }),
    db.order.count({ where: { status: "PAYMENT_REVIEW" } }),
    db.order.count({ where: { status: "DISPUTED" } }),
    db.order.aggregate({ where: { status: { in: ["DELIVERED", "COMPLETED"] } }, _sum: { feeCents: true, totalCents: true } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Pedidos" description="Pagamentos via PIX para a PVNE: confira comprovantes, acompanhe envios, resolva disputas." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pagamentos para conferir" value={review} href="/admin/pedidos?status=PAYMENT_REVIEW" tone="cyan" />
        <Stat label="Disputas abertas" value={disputes} href="/admin/pedidos?status=DISPUTED" tone="bad" />
        <Stat label="Vendido (entregue)" value={formatBRL(revenue._sum.totalCents ?? 0)} tone="ok" />
        <Stat label="Comissões (entregue)" value={formatBRL(revenue._sum.feeCents ?? 0)} tone="gold" />
      </div>
      <FilterBar action="/admin/pedidos">
        <input name="q" defaultValue={sp.q} placeholder="Código, card ou @usuário" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-56">
          <option value="">Todos</option>
          <option value="acao">Precisam de ação</option>
          {Object.entries(ORDER_STATUS_LABELS).filter(([k]) => k !== "PENDING").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FilterBar>
      <Table head={["Pedido", "Card", "Origem", "Comprador", "Vendedor", "Total", "Comissão", "Status", "Data"]} empty={rows.length === 0}>
        {rows.map((o) => (
          <tr key={o.id}>
            <Td><RowLink href={`/admin/pedidos/${o.id}`}><span className="font-mono text-xs">#{o.code}</span></RowLink></Td>
            <Td className="max-w-[200px] truncate">{o.card.name}</Td>
            <Td><Badge tone="gold">{ORDER_SOURCE_LABELS[o.source]}</Badge></Td>
            <Td className="text-mist-400">@{o.buyer.username}</Td>
            <Td className="text-mist-400">@{o.seller.username}</Td>
            <Td className="font-semibold text-gold-300 num">{formatBRL(o.totalCents || o.amountCents)}</Td>
            <Td className="num text-mist-400">{formatBRL(o.feeCents)}</Td>
            <Td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge></Td>
            <Td className="text-xs text-mist-400">{formatDateTime(o.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={(p) => `/admin/pedidos?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
