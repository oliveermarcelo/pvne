import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { listActiveCategories } from "@/server/modules/categories";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Categorias" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listActiveCategories();
  const [cards, listings] = await Promise.all([
    db.card.groupBy({ by: ["categoryId"], where: { status: "ACTIVE" }, _count: true }),
    db.listing.findMany({ where: { status: "ACTIVE" }, select: { card: { select: { categoryId: true } } } }),
  ]);
  const count = (ids: string[]) => cards.filter((c) => ids.includes(c.categoryId)).reduce((a, c) => a + c._count, 0);
  const onSale = (ids: string[]) => listings.filter((l) => ids.includes(l.card.categoryId)).length;

  return (
    <div className="container py-10">
      <PageHeader eyebrow="Explore" title="Categorias" description="Escolha um universo e descubra o que os colecionadores estão oferecendo." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const ids = [c.id, ...c.children.map((s) => s.id)];
          return (
            <Link key={c.id} href={`/categorias/${c.slug}`} className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-850 p-6 transition hover:border-white/15">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 transition group-hover:opacity-30" />
              )}
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl transition group-hover:opacity-50" style={{ background: c.color ?? "#FBDB02" }} />
              <div className="relative">
                <div className="flex items-center gap-3">
                  {c.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.iconUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-xl font-display text-sm font-bold text-ink-950" style={{ background: c.color ?? "#FBDB02" }}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                </div>
                {c.description && <p className="mt-4 line-clamp-2 text-sm text-mist-400">{c.description}</p>}
                <div className="mt-5 flex gap-5 text-xs text-mist-500">
                  <span><b className="text-mist-200 num">{count(ids)}</b> cards</span>
                  <span><b className="text-mist-200 num">{onSale(ids)}</b> anúncios ativos</span>
                </div>
                {c.children.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.children.map((s) => (
                      <span key={s.id} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-mist-400">{s.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
