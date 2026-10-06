import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { FilterBar, Table, Td } from "@/components/admin/table";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/dates";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoria · Admin" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ acao?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const where: Prisma.AuditLogWhereInput = sp.acao ? { action: { contains: sp.acao } } : {};
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { username: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Segurança" title="Registro de auditoria" description="Somente leitura — o banco impede alteração ou exclusão destes registros." />
      <FilterBar action="/admin/auditoria">
        <input name="acao" defaultValue={sp.acao} placeholder="Ação (ex.: bid, admin., auth.login)" className="field w-72" />
      </FilterBar>
      <Table head={["Data/hora", "Ação", "Autor", "Entidade", "Detalhes", "IP"]} empty={rows.length === 0}>
        {rows.map((l) => (
          <tr key={l.id}>
            <Td className="whitespace-nowrap text-xs text-mist-400">{formatDateTime(l.createdAt)}</Td>
            <Td><code className="text-xs text-gold-200">{l.action}</code></Td>
            <Td className="text-mist-400">{l.actor ? `@${l.actor.username}` : "sistema"}</Td>
            <Td className="text-xs text-mist-400">{l.entityType ? `${l.entityType}:${l.entityId?.slice(-8)}` : "—"}</Td>
            <Td className="max-w-[320px] truncate font-mono text-[11px] text-mist-500">{l.data ? JSON.stringify(l.data) : ""}</Td>
            <Td className="text-xs text-mist-500">{l.ip ?? "—"}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 50)} hrefFor={(p) => `/admin/auditoria?${new URLSearchParams({ ...(sp.acao ? { acao: sp.acao } : {}), page: String(p) })}`} />
    </>
  );
}
