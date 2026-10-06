import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { adminSaveCategoryAction } from "@/app/actions/admin";
import { CategoryForm } from "@/components/admin/category-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Editar categoria · Admin" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = await db.category.findUnique({ where: { id } });
  if (!cat) notFound();
  const parents = await db.category.findMany({ where: { parentId: null, id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow="Categorias" title={`Editar: ${cat.name}`} />
      <CategoryForm action={adminSaveCategoryAction.bind(null, cat.id)} parents={parents} values={cat} />
    </>
  );
}
