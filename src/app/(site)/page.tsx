import Link from "next/link";
import { ArrowRight, Gavel, Handshake, Search, ShieldCheck, Tag } from "lucide-react";
import { db } from "@/server/db";
import { searchMarketplace } from "@/server/modules/listings";
import { listActiveCategories } from "@/server/modules/categories";
import { ListingGrid } from "@/components/cards/listing-card";
import { CardArt } from "@/components/cards/card-art";
import { CommunityBanner } from "@/components/layout/community-banner";
import { HeroWatermark } from "@/components/layout/hero-watermark";
import { getSettings } from "@/server/settings";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();
  const [ending, recent, categories, stats, settings] = await Promise.all([
    searchMarketplace({ type: "AUCTION", phase: "live", sort: "ending", perPage: 5 }),
    searchMarketplace({ sort: "recent", perPage: 10 }),
    listActiveCategories(),
    Promise.all([
      db.user.count({ where: { status: "ACTIVE" } }),
      db.card.count({ where: { status: "ACTIVE" } }),
      db.auction.count({ where: { status: { in: ["ACTIVE", "SCHEDULED"] }, endsAt: { gt: now } } }),
    ]),
    getSettings(),
  ]);
  const [collectors, cards, liveAuctions] = stats;
  const catCounts = await db.card.groupBy({ by: ["categoryId"], where: { status: "ACTIVE" }, _count: true });
  const countOf = (id: string) => catCounts.find((c) => c.categoryId === id)?._count ?? 0;

  const hero = [...ending.items, ...recent.items].slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.05]">
        <HeroWatermark imageUrl={settings.hero_watermark_url || null} />
        <div className="container relative grid grid-cols-1 items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow">Marketplace para colecionadores</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
              Cards raros encontram <span className="text-holo">novos guardiões</span> aqui.
            </h1>
            <p className="mt-5 max-w-xl text-base text-mist-300 sm:text-lg">
              Pokémon, One Piece, Lorcana, Magic, Yu-Gi-Oh! e muito mais. Venda pelo seu preço, negocie direto com colecionadores ou coloque aquela carta especial em leilão.
            </p>
            <form action="/marketplace" className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-ink-950/70 p-1.5 shadow-card focus-within:border-gold-400/50">
              <Search className="ml-3 h-5 w-5 shrink-0 text-mist-500" aria-hidden />
              <input name="q" placeholder="Busque por nome, código ou coleção…" aria-label="Buscar cards" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none" />
              <button className="h-10 shrink-0 rounded-xl bg-foil px-5 text-sm font-semibold text-brand-800 shadow-pop hover:brightness-110">Buscar</button>
            </form>
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { v: collectors, l: "colecionadores" },
                { v: cards, l: "cards cadastrados" },
                { v: liveAuctions, l: "leilões ativos" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-display text-2xl font-semibold text-mist-100 num">{s.v.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-mist-500">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Leque de cards em destaque */}
          <div className="relative mx-auto hidden h-[440px] w-full max-w-[460px] sm:block" aria-hidden={hero.length === 0}>
            {hero.map((l, i) => {
              const rot = [-12, 0, 12][i]!;
              const x = [-34, 0, 34][i]!;
              const href = l.type === "AUCTION" && l.auction ? `/leiloes/${l.auction.id}` : `/cards/${l.card.id}`;
              return (
                <Link
                  key={l.id}
                  href={href}
                  className="group absolute left-1/2 top-1/2 w-[230px] hover:z-30"
                  style={{ transform: `translate(calc(-50% + ${x}%), -50%) rotate(${rot}deg)`, zIndex: i === 1 ? 20 : 10 }}
                >
                  <div className="rounded-2xl bg-gradient-to-br from-white/15 to-white/0 p-[1px] shadow-2xl">
                    <div className="rounded-2xl bg-ink-850 p-2.5">
                      <CardArt src={l.card.images[0]?.url} name={l.card.name} code={l.card.code} color={l.card.category.color} category={l.card.category.name} priority />
                      <div className="flex items-center justify-between px-1 pt-2.5">
                        <span className="truncate text-xs font-semibold text-mist-200">{l.card.name}</span>
                        <span className="ml-2 shrink-0 text-xs font-semibold text-gold-300 num">{formatBRL(l.currentPriceCents)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="container space-y-20 py-16">
        {/* Leilões */}
        {ending.items.length > 0 && (
          <section>
            <SectionHead eyebrow="Ao vivo" title="Leilões terminando em breve" href="/leiloes" cta="Ver todos os leilões" />
            <ListingGrid items={ending.items} />
          </section>
        )}

        {/* Categorias */}
        <section>
          <SectionHead eyebrow="Explore" title="Categorias" href="/categorias" cta="Todas as categorias" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/categorias/${c.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-850 p-5 transition hover:border-white/15"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60" style={{ background: c.color ?? "#FBDB02" }} />
                <span className="mb-6 block h-1.5 w-8 rounded-full" style={{ background: c.color ?? "#FBDB02" }} />
                <p className="font-display text-[15px] font-semibold text-mist-100">{c.name}</p>
                <p className="mt-1 text-xs text-mist-500 num">{countOf(c.id)} cards</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Recentes */}
        {recent.items.length > 0 && (
          <section>
            <SectionHead eyebrow="Novidades" title="Recém-chegados ao marketplace" href="/marketplace" cta="Abrir o marketplace" />
            <ListingGrid items={recent.items} />
          </section>
        )}

        {/* Como funciona */}
        <section className="surface overflow-hidden p-8 sm:p-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow">Como funciona</p>
              <h2 className="mt-3 text-3xl font-semibold">Três jeitos de fazer negócio</h2>
              <p className="mt-3 text-sm text-mist-400">Cada card tem um anúncio por vez — você escolhe o formato que faz mais sentido para aquela carta.</p>
              <div className="mt-6 flex items-center gap-2 text-xs text-mist-400">
                <ShieldCheck className="h-4 w-4 text-ok" /> Histórico de lances imutável e auditado
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Tag, title: "Venda direta", tone: "text-gold-300 bg-gold-400/10 border-gold-400/20", text: "Preço definido. O primeiro colecionador que confirmar leva o card." },
                { icon: Handshake, title: "Negociação", tone: "text-holo-cyan bg-holo-cyan/10 border-holo-cyan/20", text: "Preço de referência e propostas: aceite, recuse ou faça contraproposta." },
                { icon: Gavel, title: "Leilão", tone: "text-holo-violet bg-holo-violet/10 border-holo-violet/20", text: "Lance inicial, incremento e prazo. Encerramento automático no horário." },
              ].map((m) => (
                <div key={m.title} className="surface-2 p-5">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl border ${m.tone}`}>
                    <m.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
                  <p className="mt-1.5 text-sm text-mist-400">{m.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-white/5 pt-8">
            <LinkButton href="/cadastro">Começar minha coleção</LinkButton>
            <LinkButton href="/quem-somos" variant="outline">Saiba mais sobre a PVNE</LinkButton>
          </div>
        </section>

        <CommunityBanner />
      </div>
    </>
  );
}

function SectionHead({ eyebrow, title, href, cta }: { eyebrow: string; title: string; href: string; cta: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-[28px]">{title}</h2>
      </div>
      <Link href={href} className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-gold-300 hover:text-gold-200 sm:inline-flex">
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
