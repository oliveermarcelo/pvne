import type { Metadata } from "next";
import Link from "next/link";
import { Gavel, Handshake, Plus, Tag } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { listNotifications } from "@/server/modules/notifications";
import { Alert, PageHeader, Stat } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { PushToggle } from "@/components/pwa/push-toggle";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meu painel" };
export const dynamic = "force-dynamic";

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const now = new Date();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sellerStatus: true, role: true } });
  const [cards, albums, forSale, auctions, negotiating, leadingBids, won, notifications] = await Promise.all([
    db.card.count({ where: { ownerId: user.id, status: { not: "REMOVED" } } }),
    db.album.count({ where: { ownerId: user.id } }),
    db.listing.count({ where: { sellerId: user.id, status: "ACTIVE", type: { not: "AUCTION" } } }),
    db.auction.count({ where: { sellerId: user.id, status: { in: ["ACTIVE", "SCHEDULED"] }, endsAt: { gt: now } } }),
    db.negotiation.count({ where: { status: "OPEN", OR: [{ buyerId: user.id }, { sellerId: user.id }] } }),
    db.auction.count({ where: { currentBidderId: user.id, status: { in: ["ACTIVE", "SCHEDULED"] }, endsAt: { gt: now } } }),
    db.auction.count({ where: { winnerId: user.id } }),
    listNotifications(user.id, 6),
  ]);

  return (
    <>
      {sp.bemvindo && <Alert tone="ok" className="mb-6">Conta criada! Comece criando um álbum e cadastrando seus primeiros cards.</Alert>}
      <PageHeader
        eyebrow="Minha conta"
        title={`Olá, ${user.name.split(" ")[0]}!`}
        description="Resumo da sua coleção e das suas negociações."
        actions={
          <>
            <LinkButton href="/conta/albuns/novo" variant="secondary"><Plus className="h-4 w-4" /> Novo álbum</LinkButton>
            <LinkButton href="/conta/cards/novo"><Plus className="h-4 w-4" /> Cadastrar card</LinkButton>
          </>
        }
      />
      {me.role !== "ADMIN" && me.sellerStatus !== "APPROVED" && (
        <Alert tone={me.sellerStatus === "PENDING" ? "info" : "warn"} className="mb-6">
          {me.sellerStatus === "PENDING" ? "Seu pedido para vender está em análise." : me.sellerStatus === "SUSPENDED" ? "Sua habilitação de vendedor está suspensa." : <>Quer vender seus cards? <Link href="/conta/vender" className="link">Envie seu pedido para ser vendedor</Link> — comprar e dar lances já está liberado.</>}
        </Alert>
      )}
      <PushToggle onlyWhenOff className="mb-6" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Meus cards" value={cards} hint={`${albums} álbuns`} href="/conta/cards" />
        <Stat label="À venda / propostas" value={forSale} href="/conta/cards?filtro=for_sale" tone="cyan" />
        <Stat label="Meus leilões ativos" value={auctions} href="/conta/leiloes" tone="violet" />
        <Stat label="Negociações abertas" value={negotiating} href="/conta/negociacoes" tone="ok" />
        <Stat label="Liderando lances" value={leadingBids} href="/conta/lances" tone="gold" />
        <Stat label="Leilões vencidos" value={won} href="/conta/leiloes?tab=vencidos" tone="gold" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Notificações recentes</h2>
            <Link href="/conta/notificacoes" className="text-xs text-gold-300 hover:text-gold-200">Ver todas</Link>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-mist-500">Nada por aqui ainda.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "/conta/notificacoes"} className="flex gap-3 py-3 hover:opacity-90">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-gold-400")} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-mist-400">{n.body}</span>}
                      <span className="text-[11px] text-mist-500">{timeAgo(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Atalhos</h2>
          <div className="grid gap-2">
            {[
              { href: "/conta/cards?filtro=not_listed", icon: Tag, label: "Anunciar um card da coleção" },
              { href: "/leiloes", icon: Gavel, label: "Ver leilões ao vivo" },
              { href: "/conta/negociacoes", icon: Handshake, label: "Responder propostas" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="surface-2 flex items-center gap-3 p-3 text-sm text-mist-200 hover:border-white/15">
                <a.icon className="h-4 w-4 text-gold-300" /> {a.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
