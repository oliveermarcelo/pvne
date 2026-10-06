import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { CONTACT_STATUS_LABELS, CONTACT_TYPE_LABELS } from "@/lib/labels";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Contatos · Admin" };

export default async function AdminContactsPage({ searchParams }: { searchParams: Promise<{ tipo?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const where: Prisma.ContactMessageWhereInput = {
    ...(sp.tipo && sp.tipo in CONTACT_TYPE_LABELS ? { type: sp.tipo as "CONTACT" } : {}),
    ...(sp.status && sp.status in CONTACT_STATUS_LABELS ? { status: sp.status as "OPEN" } : {}),
  };
  const [rows, total] = await Promise.all([
    db.contactMessage.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: (page - 1) * 30, take: 30 }),
    db.contactMessage.count({ where }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Contatos, sugestões e reclamações" description={`${total} solicitações`} />
      <FilterBar action="/admin/contatos">
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="field w-44">
          <option value="">Todos os tipos</option>
          {Object.entries(CONTACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="field w-44">
          <option value="">Todos os status</option>
          {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FilterBar>
      <Table head={["Protocolo", "Tipo", "Assunto", "De", "Status", "Recebido"]} empty={rows.length === 0}>
        {rows.map((c) => (
          <tr key={c.id}>
            <Td className="font-mono text-xs">#{c.id.slice(-6).toUpperCase()}</Td>
            <Td><Badge tone={c.type === "COMPLAINT" ? "bad" : c.type === "SUGGESTION" ? "gold" : "neutral"}>{CONTACT_TYPE_LABELS[c.type]}</Badge></Td>
            <Td><RowLink href={`/admin/contatos/${c.id}`}>{c.subject}</RowLink></Td>
            <Td className="text-mist-400">{c.name}<span className="block text-xs text-mist-500">{c.email}</span></Td>
            <Td><Badge tone={c.status === "OPEN" ? "warn" : c.status === "IN_REVIEW" ? "cyan" : c.status === "ANSWERED" ? "ok" : "neutral"}>{CONTACT_STATUS_LABELS[c.status]}</Badge></Td>
            <Td className="text-xs text-mist-400">{formatDateTime(c.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={(p) => `/admin/contatos?${new URLSearchParams({ ...(sp.tipo ? { tipo: sp.tipo } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} />
    </>
  );
}
