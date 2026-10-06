import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Gavel, Handshake, Pencil, Plus, Tag } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listMyCards, type MyCardsFilter } from "@/server/modules/cards";
import { db } from "@/server/db";
import { CardArt } from "@/components/cards/card-art";
import { Alert, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { CONDITION_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Meus cards" };
export const dynamic = "force-dynamic";

const FILTERS: { key: MyCardsFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "for_sale", label: "À venda" },
  { key: "negotiation", label: "Em negociação" },
  { key: "auction", label: "Em leilão" },
  { key: "not_listed", label: "Só na coleção" },
];

export default async function MyCardsPage({ searchParams }: { searchParams: Promise<{ filtro?: string; album?: string; salvo?: string }> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.key === sp.filtro)?.key ?? "all") as MyCardsFilter;
  const [cards, albums] = await Promise.all([listMyCards(user.id, filter, sp.album), db.album.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } })]);

  return (
    <>
      <PageHeader eyebrow="Coleção" title="Meus cards" actions={<LinkButton href="/conta/cards/novo"><Plus className="h-4 w-4" /> Cadastrar card</LinkButton>} />
      {sp.salvo && <Alert tone="ok" className="mb-6">Card salvo. <Link href={`/conta/cards/${sp.salvo}/anunciar`} className="link">Anunciar agora</Link></Alert>}
      <Tabs active={filter} items={FILTERS.map((f) => ({ key: f.key, label: f.label, href: `/conta/cards?filtro=${f.key}${sp.album ? `&album=${sp.album}` : ""}` }))} />
      {albums.length > 0 && (
        <div className="-mt-3 mb-6 flex flex-wrap gap-1.5">
          <Link href={`/conta/cards?filtro=${filter}`} className={`rounded-full px-3 py-1 text-xs ${!sp.album ? "bg-gold-400/15 text-gold-200" : "text-mist-400 hover:text-mist-200"}`}>Todos os álbuns</Link>
          {albums.map((a) => (
            <Link key={a.id} href={`/conta/cards?filtro=${filter}&album=${a.id}`} className={`rounded-full px-3 py-1 text-xs ${sp.album === a.id ? "bg-gold-400/15 text-gold-200" : "text-mist-400 hover:text-mist-200"}`}>{a.name}</Link>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState title="Nenhum card aqui" description="Cadastre seus cards para organizar a coleção e anunciá-los." action={<LinkButton href="/conta/cards/novo">Cadastrar card</LinkButton>} />
      ) : (
        <div className="grid gap-3">
          {cards.map((c) => {
            const l = c.listings[0];
            return (
              <div key={c.id} className="surface flex items-center gap-4 p-3 sm:p-4">
                <div className="w-14 shrink-0 sm:w-16"><CardArt src={c.images[0]?.url} name={c.name} color={c.category.color} category={c.category.name} rounded="rounded-lg" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.status === "BLOCKED" && <Badge tone="bad">Bloqueado</Badge>}
                    {l ? (
                      l.type === "AUCTION" ? <Badge tone="violet"><Gavel className="h-3 w-3" /> Leilão · {l.auction?.bidCount ?? 0} lances</Badge>
                      : l.type === "NEGOTIATION" ? <Badge tone="cyan"><Handshake className="h-3 w-3" /> Aceita propostas</Badge>
                      : <Badge tone="gold"><Tag className="h-3 w-3" /> À venda</Badge>
                    ) : <Badge>Na coleção</Badge>}
                  </div>
                  <p className="mt-1 truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-mist-500">{[c.category.name, c.setName, c.code, CONDITION_LABELS[c.condition], c.album?.name].filter(Boolean).join(" · ")}{c.quantity > 1 ? ` · ${c.quantity} un.` : ""}</p>
                </div>
                {l && <p className="hidden shrink-0 text-right font-display font-semibold text-gold-300 num sm:block">{formatBRL(l.currentPriceCents)}</p>}
                <div className="flex shrink-0 gap-1">
                  <LinkButton href={l?.auction ? `/leiloes/${l.auction.id}` : `/cards/${c.id}`} variant="ghost" size="sm" aria-label="Ver"><Eye className="h-4 w-4" /></LinkButton>
                  <LinkButton href={`/conta/cards/${c.id}/editar`} variant="ghost" size="sm" aria-label="Editar"><Pencil className="h-4 w-4" /></LinkButton>
                  {!l && c.status === "ACTIVE" && <LinkButton href={`/conta/cards/${c.id}/anunciar`} variant="secondary" size="sm">Anunciar</LinkButton>}
                  {l && c.status === "ACTIVE" && !(l.auction && l.auction.bidCount > 0) && <LinkButton href={`/conta/cards/${c.id}/anuncio`} variant="secondary" size="sm">Editar anúncio</LinkButton>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
