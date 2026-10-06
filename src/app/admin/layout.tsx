import Link from "next/link";
import { ArrowLeft, BadgeCheck, Banknote, FileText, Gavel, Handshake, Inbox, Layers, LayoutDashboard, ScrollText, Settings, Store, Tag, Users } from "lucide-react";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SideLink } from "@/components/layout/nav-link";
import { ScrollNav } from "@/components/layout/scroll-nav";
import { LogoImage } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const [openContacts, pendingSellers, ordersToReview, payouts] = await Promise.all([
    db.contactMessage.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.sellerApplication.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: { in: ["PAYMENT_REVIEW", "DISPUTED"] } } }),
    db.order.count({ where: { payoutStatus: "PENDING" } }),
  ]);
  const n = (v: number) => (v ? ` (${v})` : "");
  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/vendedores", label: `Vendedores${n(pendingSellers)}`, icon: BadgeCheck },
    { href: "/admin/categorias", label: "Categorias", icon: Tag },
    { href: "/admin/cards", label: "Cards e anúncios", icon: Layers },
    { href: "/admin/leiloes", label: "Leilões", icon: Gavel },
    { href: "/admin/negociacoes", label: "Negociações", icon: Handshake },
    { href: "/admin/pedidos", label: `Pedidos${n(ordersToReview)}`, icon: Store },
    { href: "/admin/repasses", label: `Repasses${n(payouts)}`, icon: Banknote },
    { href: "/admin/contatos", label: `Contatos${n(openContacts)}`, icon: Inbox },
    { href: "/admin/paginas", label: "Páginas", icon: FileText },
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
    { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:h-screen lg:border-b-0 lg:border-r lg:bg-ink-950/70">
        <div className="flex h-14 items-center gap-2.5 px-4 lg:h-16 lg:px-5">
          <Link href="/admin" aria-label="Painel administrativo"><LogoImage height={34} /></Link>
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-mist-400">Admin</span>
          <Link href="/" className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-mist-400 hover:bg-white/5 hover:text-gold-200 lg:hidden">
            <ArrowLeft className="h-3.5 w-3.5" /> Ver site
          </Link>
          <Link href={`/admin/usuarios/${admin.id}`} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/5 lg:hidden" aria-label="Meu cadastro" title="Meu cadastro">
            <Avatar name={admin.name} src={admin.avatarUrl} size={30} />
          </Link>
        </div>
        <ScrollNav label="Menu do admin" className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2.5 lg:flex-col lg:pb-24">
          {nav.map((n) => (
            <SideLink key={n.href} href={n.href} exact={n.exact} icon={<n.icon className="h-4 w-4" />}>{n.label}</SideLink>
          ))}
        </ScrollNav>
        <div className="hidden border-t border-white/[0.06] p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <div className="flex items-center gap-2.5">
            <Avatar name={admin.name} src={admin.avatarUrl} size={32} />
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold">{admin.name}</p>
              <span className="flex flex-wrap gap-x-3">
                <Link href={`/admin/usuarios/${admin.id}`} className="text-mist-500 hover:text-gold-200">Meu cadastro</Link>
                <Link href="/" className="inline-flex items-center gap-1 text-mist-500 hover:text-gold-200"><ArrowLeft className="h-3 w-3" /> Voltar ao site</Link>
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pt-8 lg:py-10">{children}</main>
    </div>
  );
}
