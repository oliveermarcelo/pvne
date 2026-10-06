import type { Metadata } from "next";
import Link from "next/link";
import { dashboardStats } from "@/server/modules/admin";
import { db } from "@/server/db";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/cards/countdown";
import { formatBRL } from "@/lib/money";
import { timeAgo } from "@/lib/dates";
import { CONTACT_STATUS_LABELS, CONTACT_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const now = new Date();
  const [s, contacts, auctions] = await Promise.all([
    dashboardStats(),
    db.contactMessage.findMany({ where: { status: { in: ["OPEN", "IN_REVIEW"] } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.auction.findMany({
      where: { status: { in: ["ACTIVE", "SCHEDULED"] }, endsAt: { gt: now }, startsAt: { lte: now } },
      orderBy: { endsAt: "asc" },
      take: 6,
      include: { listing: { select: { card: { select: { name: true } } } } },
    }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administração" title="Dashboard" />
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Vendedores para aprovar" value={s.pendingSellers} href="/admin/vendedores" tone={s.pendingSellers ? "bad" : "ok"} />
        <Stat label="Pagamentos para conferir" value={s.paymentsToReview} href="/admin/pedidos?status=PAYMENT_REVIEW" tone={s.paymentsToReview ? "bad" : "ok"} />
        <Stat label="Disputas abertas" value={s.disputes} href="/admin/pedidos?status=DISPUTED" tone={s.disputes ? "bad" : "ok"} />
        <Stat label="Repasses pendentes" value={formatBRL(s.payoutsCents)} hint={`${s.payoutsCount} pedido(s) · comissões: ${formatBRL(s.feesCents)}`} href="/admin/repasses" tone="gold" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Usuários" value={s.users} hint={`${s.blockedUsers} bloqueados`} href="/admin/usuarios" />
        <Stat label="Cards" value={s.cards} href="/admin/cards" tone="cyan" />
        <Stat label="Álbuns" value={s.albums} tone="cyan" />
        <Stat label="Cards à venda" value={s.forSale} href="/admin/cards?anuncio=venda" tone="gold" />
        <Stat label="Leilões ativos" value={s.activeAuctions} href="/admin/leiloes?status=ativos" tone="violet" />
        <Stat label="Leilões encerrados" value={s.endedAuctions} href="/admin/leiloes?status=ENDED" tone="violet" />
        <Stat label="Total de lances" value={s.bids} tone="violet" />
        <Stat label="Negociações em andamento" value={s.openNegotiations} href="/admin/negociacoes?status=OPEN" tone="ok" />
        <Stat label="Pedidos" value={s.orders} hint={`${formatBRL(s.gmvCents)} transacionados`} href="/admin/pedidos" tone="ok" />
        <Stat label="Sugestões" value={s.suggestions} href="/admin/contatos?tipo=SUGGESTION" tone="gold" />
        <Stat label="Reclamações" value={s.complaints} hint={`${s.openContacts} solicitações abertas`} href="/admin/contatos?tipo=COMPLAINT" tone="bad" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="surface p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Leilões terminando</h2><Link href="/admin/leiloes" className="text-xs text-gold-300">Ver todos</Link></div>
          <ul className="divide-y divide-white/5 text-sm">
            {auctions.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/leiloes/${a.id}`} className="truncate hover:text-gold-200">{a.listing.card.name}</Link>
                <span className="flex shrink-0 items-center gap-3 text-xs"><Countdown to={a.endsAt} /><span className="font-semibold text-gold-300 num">{formatBRL(a.currentBidCents ?? a.startingBidCents)}</span></span>
              </li>
            ))}
            {auctions.length === 0 && <li className="py-3 text-mist-500">Nenhum leilão ao vivo.</li>}
          </ul>
        </section>
        <section className="surface p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Solicitações abertas</h2><Link href="/admin/contatos" className="text-xs text-gold-300">Ver todas</Link></div>
          <ul className="divide-y divide-white/5 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/contatos/${c.id}`} className="min-w-0 truncate hover:text-gold-200">{c.subject}</Link>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={c.type === "COMPLAINT" ? "bad" : c.type === "SUGGESTION" ? "gold" : "neutral"}>{CONTACT_TYPE_LABELS[c.type]}</Badge>
                  <Badge>{CONTACT_STATUS_LABELS[c.status]}</Badge>
                  <span className="text-xs text-mist-500">{timeAgo(c.createdAt)}</span>
                </span>
              </li>
            ))}
            {contacts.length === 0 && <li className="py-3 text-mist-500">Nenhuma solicitação aberta.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
