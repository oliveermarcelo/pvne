import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { requireAdminPage } from "@/server/auth/guards";
import { UserPlus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { Alert, Avatar, PageHeader, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuários · Admin" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; excluido?: string }> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const where: Prisma.UserWhereInput = {
    ...(sp.status && ["ACTIVE", "BLOCKED", "DELETED"].includes(sp.status) ? { status: sp.status as "ACTIVE" } : { status: { not: "DELETED" } }),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { username: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { _count: { select: { cards: true, bids: true, listings: true } } } }),
    db.user.count({ where }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description={`${total} usuários`}
        actions={<LinkButton href="/admin/usuarios/novo"><UserPlus className="h-4 w-4" /> Novo usuário</LinkButton>}
      />
      {sp.excluido && <Alert tone="ok" className="mb-5">Usuário excluído (dados anonimizados).</Alert>}
      <FilterBar action="/admin/usuarios">
        <input name="q" defaultValue={sp.q} placeholder="Nome, e-mail ou usuário" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-44">
          <option value="">Ativos e bloqueados</option>
          {Object.entries(USER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FilterBar>
      <Table head={["Usuário", "E-mail", "Local", "Papel", "Status", "Cards", "Lances", "Cadastro"]} empty={users.length === 0}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td>
              <span className="flex items-center gap-2.5">
                <Avatar name={u.name} src={u.avatarUrl} size={28} />
                <span className="min-w-0">
                  <RowLink href={`/admin/usuarios/${u.id}`}>{u.name}</RowLink>
                  <span className="block text-xs text-mist-500">@{u.username}{u.id === admin.id && <span className="ml-1.5 rounded bg-holo-violet/20 px-1.5 py-0.5 text-[10px] font-semibold text-holo-violet">você</span>}</span>
                </span>
              </span>
            </Td>
            <Td className="text-mist-400">{u.email}</Td>
            <Td className="text-mist-400">{u.city ? `${u.city}/${u.state ?? ""}` : "—"}</Td>
            <Td>{u.role === "ADMIN" ? <Badge tone="violet">{USER_ROLE_LABELS.ADMIN}</Badge> : <span className="text-mist-400">{USER_ROLE_LABELS.USER}</span>}</Td>
            <Td><Badge tone={u.status === "ACTIVE" ? "ok" : "bad"}>{USER_STATUS_LABELS[u.status]}</Badge></Td>
            <Td className="num">{u._count.cards}</Td>
            <Td className="num">{u._count.bids}</Td>
            <Td className="text-mist-400">{formatDate(u.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={(p) => `/admin/usuarios?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} />
    </>
  );
}
