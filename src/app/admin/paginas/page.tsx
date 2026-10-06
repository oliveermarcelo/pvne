import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { EDITABLE_PAGES } from "@/server/modules/pages";
import { PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Páginas · Admin" };

export default async function AdminPagesPage() {
  const pages = await db.page.findMany({ include: { updatedBy: { select: { name: true } } } });
  return (
    <>
      <PageHeader eyebrow="Conteúdo" title="Páginas institucionais" description="Conteúdo em Markdown (títulos com ##, listas com -, negrito com **texto**)." />
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(EDITABLE_PAGES).map(([slug, label]) => {
          const p = pages.find((x) => x.slug === slug);
          return (
            <Link key={slug} href={`/admin/paginas/${slug}`} className="surface p-5 transition hover:border-white/15">
              <p className="font-semibold">{label}</p>
              <p className="mt-1 text-xs text-mist-500">/{slug} · {p ? `atualizada em ${formatDateTime(p.updatedAt)}${p.updatedBy ? ` por ${p.updatedBy.name}` : ""}` : "ainda não criada"}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
