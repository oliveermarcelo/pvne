import type { Metadata } from "next";
import { requireUserPage } from "@/server/auth/guards";
import { categoryOptions } from "@/server/modules/categories";
import { db } from "@/server/db";
import { saveCardAction } from "@/app/actions/catalog";
import { CardForm } from "@/components/account/card-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Cadastrar card" };

export default async function NewCardPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const [categories, albums] = await Promise.all([categoryOptions(), db.album.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, categoryId: true } })]);
  const album = albums.find((a) => a.id === sp.album);
  return (
    <>
      <PageHeader eyebrow="Coleção" title="Cadastrar card" description="Adicione o card à sua coleção. Você decide depois se quer vender, negociar ou leiloar." />
      <CardForm action={saveCardAction.bind(null, null)} categories={categories} albums={albums} isNew values={{ albumId: album?.id, categoryId: album?.categoryId }} />
    </>
  );
}
