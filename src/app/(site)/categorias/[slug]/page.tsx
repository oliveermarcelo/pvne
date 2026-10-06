import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/server/modules/categories";
import { MarketplaceView } from "@/components/market/marketplace-view";
import { PageHeader } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCategoryBySlug((await params).slug);
  return { title: c?.name ?? "Categoria" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  const sp = await searchParams;
  return (
    <div className="container py-10">
      <nav className="mb-4 text-xs text-mist-500">
        <Link href="/categorias" className="hover:text-mist-300">Categorias</Link>
        {cat.parent && <> / <Link href={`/categorias/${cat.parent.slug}`} className="hover:text-mist-300">{cat.parent.name}</Link></>}
      </nav>
      <PageHeader
        eyebrow="Categoria"
        title={<span className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: cat.color ?? "#FBDB02" }} />{cat.name}</span>}
        description={cat.description}
      />
      {cat.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cat.children.map((s) => (
            <Link key={s.id} href={`/categorias/${s.slug}`} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-mist-300 hover:border-gold-400/40 hover:text-gold-200">{s.name}</Link>
          ))}
        </div>
      )}
      <MarketplaceView params={sp} basePath={`/categorias/${slug}`} lock={{ category: slug }} hideFilters={["category"]} />
    </div>
  );
}
