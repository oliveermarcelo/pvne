import type { Metadata } from "next";
import type { Prisma } from "@/server/db";
import { db } from "@/server/db";
import { FilterBar, RowLink, Table, Td } from "@/components/admin/table";
import { CardArt } from "@/components/cards/card-art";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { CARD_STATUS_LABELS, LISTING_TYPE_LABELS } from "@/lib/labels";
import { pageNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Cards · Admin" };

export default async function AdminCardsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; anuncio?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const where: Prisma.CardWhereInput = {
    ...(sp.status && sp.status in CARD_STATUS_LABELS ? { status: sp.status as "ACTIVE" } : {}),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { code: { contains: sp.q, mode: "insensitive" } }, { owner: { username: { contains: sp.q, mode: "insensitive" } } }] } : {}),
    ...(sp.anuncio === "venda" ? { listings: { some: { status: "ACTIVE", type: { not: "AUCTION" } } } } : sp.anuncio === "leilao" ? { listings: { some: { status: "ACTIVE", type: "AUCTION" } } } : sp.anuncio === "nenhum" ? { listings: { none: { status: "ACTIVE" } } } : {}),
  };
  const [cards, total] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 30,
      take: 30,
      include: { owner: { select: { username: true } }, category: true, images: { take: 1, orderBy: { position: "asc" } }, listings: { where: { status: "ACTIVE" } } },
    }),
    db.card.count({ where }),
  ]);
  const qs = (p: number) => `/admin/cards?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")), page: String(p) } as Record<string, string>)}`;
  return (
    <>
      <PageHeader eyebrow="Administração" title="Cards e anúncios" description={`${total} cards`} />
      <FilterBar action="/admin/cards">
        <input name="q" defaultValue={sp.q} placeholder="Nome, código ou @usuário" className="field w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="field w-40">
          <option value="">Qualquer status</option>
          {Object.entries(CARD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="anuncio" defaultValue={sp.anuncio ?? ""} className="field w-44">
          <option value="">Com ou sem anúncio</option>
          <option value="venda">À venda / propostas</option>
          <option value="leilao">Em leilão</option>
          <option value="nenhum">Sem anúncio</option>
        </select>
      </FilterBar>
      <Table head={["", "Card", "Dono", "Categoria", "Anúncio", "Status", "Cadastro"]} empty={cards.length === 0}>
        {cards.map((c) => {
          const l = c.listings[0];
          return (
            <tr key={c.id}>
              <Td className="w-12"><div className="w-9"><CardArt src={c.images[0]?.url} name={c.name} color={c.category.color} rounded="rounded-md" /></div></Td>
              <Td><RowLink href={`/admin/cards/${c.id}`}>{c.name}</RowLink><span className="block text-xs text-mist-500">{[c.setName, c.code].filter(Boolean).join(" · ")}</span></Td>
              <Td className="text-mist-400">@{c.owner.username}</Td>
              <Td className="text-mist-400">{c.category.name}</Td>
              <Td>{l ? <span className="flex items-center gap-2"><Badge tone={l.type === "AUCTION" ? "violet" : "gold"}>{LISTING_TYPE_LABELS[l.type]}</Badge><span className="num text-xs">{formatBRL(l.currentPriceCents)}</span></span> : <span className="text-mist-500">—</span>}</Td>
              <Td><Badge tone={c.status === "ACTIVE" ? "ok" : "bad"}>{CARD_STATUS_LABELS[c.status]}</Badge></Td>
              <Td className="text-mist-400">{formatDate(c.createdAt)}</Td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} hrefFor={qs} />
    </>
  );
}
