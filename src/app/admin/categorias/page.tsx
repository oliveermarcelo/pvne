import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { adminDeleteCategoryAction, adminToggleCategoryAction } from "@/app/actions/admin";
import { RowLink, Table, Td } from "@/components/admin/table";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Categorias · Admin" };

export default async function AdminCategoriesPage() {
  const cats = await db.category.findMany({
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: { parent: { select: { name: true } }, _count: { select: { cards: true, albums: true, children: true } } },
  });
  const ordered = cats.filter((c) => !c.parentId).flatMap((p) => [p, ...cats.filter((c) => c.parentId === p.id)]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Categorias" actions={<LinkButton href="/admin/categorias/nova"><Plus className="h-4 w-4" /> Nova categoria</LinkButton>} />
      <Table head={["Categoria", "Slug", "Ordem", "Cards", "Álbuns", "Status", "Ações"]} empty={ordered.length === 0}>
        {ordered.map((c) => (
          <tr key={c.id}>
            <Td>
              <span className={`flex items-center gap-2.5 ${c.parentId ? "pl-6" : ""}`}>
                <span className="h-3 w-3 rounded-full" style={{ background: c.color ?? "#FBDB02" }} />
                <RowLink href={`/admin/categorias/${c.id}`}>{c.parentId ? `↳ ${c.name}` : c.name}</RowLink>
              </span>
            </Td>
            <Td className="text-mist-400"><code>{c.slug}</code></Td>
            <Td className="num">{c.sortOrder}</Td>
            <Td className="num">{c._count.cards}</Td>
            <Td className="num">{c._count.albums}</Td>
            <Td><Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "Ativa" : "Inativa"}</Badge></Td>
            <Td>
              <span className="flex flex-wrap gap-2">
                <ConfirmButton action={adminToggleCategoryAction.bind(null, c.id)} skipConfirm variant="ghost">{c.active ? "Desativar" : "Ativar"}</ConfirmButton>
                {c._count.cards + c._count.albums + c._count.children === 0 && (
                  <ConfirmButton action={adminDeleteCategoryAction.bind(null, c.id)} variant="danger" question="Excluir?" confirmText="Excluir">Excluir</ConfirmButton>
                )}
              </span>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
