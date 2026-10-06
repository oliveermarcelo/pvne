import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { searchMarketplace, type MarketFilters } from "@/server/modules/listings";
import { listActiveCategories } from "@/server/modules/categories";
import { ListingGrid } from "@/components/cards/listing-card";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { CONDITION_LABELS, LISTING_TYPE_LABELS } from "@/lib/labels";
import { parseBRLToCents } from "@/lib/money";
import { pageNumber, sp } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

export function filtersFromParams(params: SP, overrides: Partial<MarketFilters> = {}): MarketFilters {
  const sort = sp(params.sort);
  const phase = sp(params.fase);
  return {
    q: sp(params.q),
    category: sp(params.categoria),
    album: sp(params.album),
    condition: sp(params.estado),
    type: sp(params.tipo),
    min: parseBRLToCents(sp(params.min) ?? "") ?? undefined,
    max: parseBRLToCents(sp(params.max) ?? "") ?? undefined,
    seller: sp(params.vendedor),
    phase: phase === "agendados" ? "scheduled" : phase === "ao-vivo" ? "live" : undefined,
    sort: sort === "price_asc" || sort === "price_desc" || sort === "ending" ? sort : "recent",
    page: pageNumber(params.page),
    ...overrides,
  };
}

/**
 * Listagem com busca e filtros (formulário GET — funciona sem JavaScript e gera URLs compartilháveis).
 * `basePath` e `lock` permitem reutilizar em /marketplace, /leiloes e /categorias/[slug].
 */
export async function MarketplaceView({
  params,
  basePath,
  lock = {},
  hideFilters = [],
}: {
  params: SP;
  basePath: string;
  lock?: Partial<MarketFilters>;
  hideFilters?: ("category" | "type")[];
}) {
  const filters = filtersFromParams(params, lock);
  const [result, categories] = await Promise.all([searchMarketplace(filters), listActiveCategories()]);

  const keep = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const val = sp(v);
      if (val && k !== "page") q.set(k, val);
    }
    for (const [k, v] of Object.entries(extra)) v === undefined ? q.delete(k) : q.set(k, v);
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  const active: { key: string; label: string }[] = [];
  if (filters.q) active.push({ key: "q", label: `“${filters.q}”` });
  if (!lock.category && filters.category) active.push({ key: "categoria", label: categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === filters.category)?.name ?? filters.category });
  if (filters.condition && filters.condition in CONDITION_LABELS) active.push({ key: "estado", label: CONDITION_LABELS[filters.condition as keyof typeof CONDITION_LABELS] });
  if (!lock.type && filters.type && filters.type in LISTING_TYPE_LABELS) active.push({ key: "tipo", label: LISTING_TYPE_LABELS[filters.type as keyof typeof LISTING_TYPE_LABELS] });
  if (sp(params.min)) active.push({ key: "min", label: `a partir de R$ ${sp(params.min)}` });
  if (sp(params.max)) active.push({ key: "max", label: `até R$ ${sp(params.max)}` });
  if (filters.seller) active.push({ key: "vendedor", label: `@${filters.seller}` });

  const panel = (
    <form action={basePath} className="space-y-6">
      {sp(params.fase) && <input type="hidden" name="fase" value={sp(params.fase)} />}
      <div>
        <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-mist-400">Buscar</label>
        <input id="q" name="q" defaultValue={filters.q} placeholder="Nome, código, coleção…" className="field" />
      </div>
      {!hideFilters.includes("category") && (
        <div>
          <label htmlFor="categoria" className="mb-1.5 block text-xs font-medium text-mist-400">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={filters.category ?? ""} className="field">
            <option value="">Todas</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.slug}>{c.name} (todas)</option>
                {c.children.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      {!hideFilters.includes("type") && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-mist-400">Tipo de venda</legend>
          <div className="space-y-1.5">
            {[["", "Todos"], ...Object.entries(LISTING_TYPE_LABELS)].map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm text-mist-300">
                <input type="radio" name="tipo" value={v} defaultChecked={(filters.type ?? "") === v} className="accent-[#FBDB02]" /> {l}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor="estado" className="mb-1.5 block text-xs font-medium text-mist-400">Estado de conservação</label>
        <select id="estado" name="estado" defaultValue={filters.condition ?? ""} className="field">
          <option value="">Qualquer</option>
          {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-mist-400">Faixa de preço (R$)</legend>
        <div className="flex items-center gap-2">
          <input name="min" defaultValue={sp(params.min)} placeholder="Mín." inputMode="decimal" className="field" aria-label="Preço mínimo" />
          <span className="text-mist-500">–</span>
          <input name="max" defaultValue={sp(params.max)} placeholder="Máx." inputMode="decimal" className="field" aria-label="Preço máximo" />
        </div>
      </fieldset>
      <div>
        <label htmlFor="sort" className="mb-1.5 block text-xs font-medium text-mist-400">Ordenar por</label>
        <select id="sort" name="sort" defaultValue={filters.sort} className="field">
          <option value="recent">Mais recentes</option>
          <option value="ending">Terminando antes (leilões)</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button className="h-10 flex-1 rounded-xl bg-foil text-sm font-semibold text-brand-800 shadow-pop hover:brightness-110">Aplicar filtros</button>
        <Link href={basePath + (sp(params.fase) ? `?fase=${sp(params.fase)}` : "")} className="grid h-10 place-items-center rounded-xl px-3 text-sm text-mist-400 hover:bg-white/5">Limpar</Link>
      </div>
    </form>
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <details className="surface group p-5 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-gold-300" /> Filtros {active.length > 0 && `(${active.length})`}</span>
            <span className="text-xs text-mist-500 group-open:hidden">mostrar</span>
          </summary>
          <div className="mt-5">{panel}</div>
        </details>
        <div className="surface hidden p-5 lg:block">{panel}</div>
      </aside>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm text-mist-400">
            <span className="font-semibold text-mist-100 num">{result.total}</span> {result.total === 1 ? "card encontrado" : "cards encontrados"}
          </p>
          {active.map((a) => (
            <Link key={a.key} href={keep({ [a.key]: undefined })} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-mist-300 hover:border-bad/40 hover:text-bad">
              {a.label} <X className="h-3 w-3" />
            </Link>
          ))}
        </div>
        {result.items.length ? (
          <>
            <ListingGrid items={result.items} />
            <Pagination page={result.page} pages={result.pages} hrefFor={(p) => keep({ page: String(p) })} />
          </>
        ) : (
          <EmptyState title="Nenhum card encontrado" description="Tente remover alguns filtros ou buscar por outro termo." action={<Link href={basePath} className="link text-sm">Limpar filtros</Link>} />
        )}
      </div>
    </div>
  );
}
