import Link from "next/link";
import { Bell, BookOpen, ChevronDown, Download, Gavel, Heart, Info, Layers, LayoutDashboard, LayoutGrid, LogOut, Mail, Menu, Search, Settings, Shield, Store, User, X } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { unreadCount } from "@/server/modules/notifications";
import { getSettings } from "@/server/settings";
import { db } from "@/server/db";
import { logoutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { AppSync } from "@/components/pwa/app-sync";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { MenuDetails } from "./menu-details";
import { TabBar } from "./tab-bar";

export const MAIN_NAV = [
  { href: "/", label: "Início", exact: true },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/leiloes", label: "Leilões" },
  { href: "/categorias", label: "Categorias" },
];

export const ACCOUNT_NAV = [
  { href: "/conta/cards", label: "Meus cards" },
  { href: "/conta/favoritos", label: "Favoritos" },
  { href: "/conta/negociacoes", label: "Negociações" },
  { href: "/conta/perfil", label: "Perfil" },
];

const MORE_NAV = [
  { href: "/categorias", label: "Categorias", icon: LayoutGrid },
  { href: "/como-funciona", label: "Como funciona", icon: BookOpen },
  { href: "/quem-somos", label: "Quem Somos", icon: Info },
  { href: "/contato", label: "Contato e sugestões", icon: Mail },
  { href: "/instalar", label: "Instalar o app", icon: Download },
];

export async function Header() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const [unread, pendingOrders] = user
    ? await Promise.all([
        unreadCount(user.id),
        // Pedidos esperando uma ação sua: pagar (comprador) ou enviar (vendedor)
        db.order.count({ where: { OR: [{ buyerId: user.id, status: "AWAITING_PAYMENT" }, { sellerId: user.id, status: "PAID" }] } }),
      ])
    : [0, 0];

  const accountLinks = user
    ? [
        { href: "/conta", label: "Meu painel", icon: LayoutDashboard },
        { href: "/conta/cards", label: "Meus cards", icon: Layers },
        { href: "/conta/lances", label: "Meus lances", icon: Gavel },
        { href: "/conta/favoritos", label: "Favoritos", icon: Heart },
        { href: "/conta/pedidos", label: "Compras e vendas", icon: Store },
        { href: `/colecionador/${user.username}`, label: "Meu perfil público", icon: User },
        { href: "/conta/perfil", label: "Configurações", icon: Settings },
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Painel administrativo", icon: Shield }] : []),
      ]
    : [];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-400/15 pt-[env(safe-area-inset-top)]">
        {/* O desfoque fica numa camada separada: backdrop-filter no <header> prenderia o menu "fixed" dentro dele */}
        <div className="absolute inset-0 -z-10 bg-ink-900/85 backdrop-blur-xl" aria-hidden />
        <div className="h-[3px] bg-gradient-to-r from-brand-500 via-gold-400 to-brand-500" aria-hidden />
        <div className="container flex h-14 items-center gap-2 sm:h-16 sm:gap-4">
          {/* Menu "mais" no celular (a navegação principal fica na barra de abas inferior) */}
          <MenuDetails
            className="group relative lg:hidden"
            label="Abrir menu"
            summaryClassName="grid h-11 w-11 -ml-2 cursor-pointer list-none place-items-center rounded-xl text-mist-300 hover:bg-white/5 [&::-webkit-details-marker]:hidden"
            summary={
              <>
                <Menu className="h-5 w-5 group-open:hidden" />
                <X className="hidden h-5 w-5 group-open:block" />
              </>
            }
          >
            <div data-menu-close className="fixed inset-0 top-[calc(3.5rem+3px+env(safe-area-inset-top))] z-40 bg-ink-950/60 backdrop-blur-sm sm:top-[calc(4rem+3px+env(safe-area-inset-top))]" aria-hidden />
            <div className="fixed inset-x-0 top-[calc(3.5rem+3px+env(safe-area-inset-top))] z-50 max-h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-b-3xl border-b border-brand-400/15 bg-ink-900 p-3 shadow-2xl sm:top-[calc(4rem+3px+env(safe-area-inset-top))]">
              <nav className="grid gap-0.5">
                {MORE_NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-mist-200 active:bg-white/5">
                    <n.icon className="h-[18px] w-[18px] text-mist-500" /> {n.label}
                  </Link>
                ))}
                {user ? (
                  <form action={logoutAction} className="mt-1 border-t border-white/5 pt-1">
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-mist-300 active:bg-white/5">
                      <LogOut className="h-[18px] w-[18px] text-mist-500" /> Sair da conta
                    </button>
                  </form>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
                    <LinkButton href="/entrar" variant="secondary" size="lg">Entrar</LinkButton>
                    <LinkButton href="/cadastro" size="lg">Criar conta</LinkButton>
                  </div>
                )}
              </nav>
            </div>
          </MenuDetails>

          <Logo name={settings.site_name} height={40} className="max-sm:[&_img]:!h-9" />

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {MAIN_NAV.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact}>{n.label}</NavLink>
            ))}
            {user &&
              ACCOUNT_NAV.map((n, i) => (
                <NavLink key={n.href} href={n.href} className={i === 3 ? "hidden xl:block" : undefined}>{n.label}</NavLink>
              ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            <Link href="/marketplace" className="grid h-11 w-11 place-items-center rounded-xl text-mist-300 hover:bg-white/5 hover:text-mist-100" aria-label="Buscar cards">
              <Search className="h-5 w-5" />
            </Link>
            {user ? (
              <>
                <Link href="/conta/notificacoes" className="relative grid h-11 w-11 place-items-center rounded-xl text-mist-300 hover:bg-white/5 hover:text-mist-100" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white num">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <MenuDetails
                  className="group relative"
                  label="Menu da conta"
                  summaryClassName="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl py-1 pl-1 pr-1 hover:bg-white/5 sm:pr-2 [&::-webkit-details-marker]:hidden"
                  summary={
                    <>
                      <Avatar name={user.name} src={user.avatarUrl} size={32} />
                      <ChevronDown className="hidden h-4 w-4 text-mist-400 transition group-open:rotate-180 sm:block" />
                    </>
                  }
                >
                  <div className="absolute right-0 top-[3.25rem] z-50 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-ink-850 p-1.5 shadow-2xl">
                    <div className="border-b border-white/5 px-3 pb-3 pt-2">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-mist-500">@{user.username}</p>
                    </div>
                    <div className="py-1">
                      {accountLinks.map((i) => (
                        <Link key={i.href} href={i.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-mist-300 hover:bg-white/5 hover:text-mist-100">
                          <i.icon className="h-4 w-4 text-mist-500" /> {i.label}
                        </Link>
                      ))}
                    </div>
                    <form action={logoutAction} className="border-t border-white/5 pt-1">
                      <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-mist-300 hover:bg-white/5 hover:text-bad">
                        <LogOut className="h-4 w-4" /> Sair
                      </button>
                    </form>
                  </div>
                </MenuDetails>
                <AppSync unread={unread} />
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <LinkButton href="/entrar" variant="ghost">Entrar</LinkButton>
                <LinkButton href="/cadastro">Criar conta</LinkButton>
              </div>
            )}
          </div>
        </div>
      </header>
      <TabBar loggedIn={!!user} pendingOrders={pendingOrders} />
    </>
  );
}
