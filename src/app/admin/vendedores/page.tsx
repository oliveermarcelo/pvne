import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { maskDocument } from "@/lib/documents";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendedores · Admin" };

const STATUS = { PENDING: "Em análise", APPROVED: "Aprovado", REJECTED: "Recusado" } as const;

export default async function AdminSellersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const status = sp.status === undefined ? "PENDING" : sp.status;
  const where: Prisma.SellerApplicationWhereInput = {
    ...(status && status in STATUS ? { status: status as "PENDING" } : {}),
    ...(sp.q ? { OR: [{ legalName: { contains: sp.q, mode: "insensitive" } }, { document: { contains: sp.q.replace(/\D/g, "") || sp.q } }, { user: { username: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.sellerApplication.findMany({ where, orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" }, skip: (page - 1) * 30, take: 30, include: { user: { select: { username: true, sellerStatus: true } } } }),
    db.sellerApplication.count({ where }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Pedidos de vendedor" description="Aprove quem pode anunciar na plataforma. Documentos ficam em área privada." />
      <FilterBar action="/admin/vendedores">
        <input name="q" defaultValue={sp.q} placeholder="Nome, CPF/CNPJ ou @usuário" className="field w-64" />
        <select name="status" defaultValue={status} className="field w-44">
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FilterBar>
      <Table head={["Enviado em", "Titular", "Usuário", "Documento", "Cidade/UF", "Status"]} empty={rows.length === 0}>
        {rows.map((a) => (
          <tr key={a.id}>
            <Td className="text-xs text-mist-400">{formatDateTime(a.createdAt)}</Td>
            <Td><RowLink href={`/admin/vendedores/${a.id}`}>{a.legalName}</RowLink><span className="block text-xs text-mist-500">{a.personType === "PF" ? "Pessoa física" : "Pessoa jurídica"}</span></Td>
            <Td className="text-mist-400">@{a.user.username}</Td>
            <Td className="font-mono text-xs">{maskDocument(a.document)}</Td>
            <Td className="text-mist-400">{a.city}/{a.state}</Td>
            <Td><Badge tone={a.status === "PENDING" ? "warn" : a.status === "APPROVED" ? "ok" : "bad"}>{STATUS[a.status]}</Badge></Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={(p) => `/admin/vendedores?${new URLSearchParams({ status, ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
