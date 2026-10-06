import type { Metadata } from "next";
import { db } from "@/server/db";
import { adminSaveCategoryAction } from "@/app/actions/admin";
import { CategoryForm } from "@/components/admin/category-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Nova categoria · Admin" };

export default async function NewCategoryPage() {
  const parents = await db.category.findMany({ where: { parentId: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow="Categorias" title="Nova categoria" />
      <CategoryForm action={adminSaveCategoryAction.bind(null, null)} parents={parents} />
    </>
  );
}
