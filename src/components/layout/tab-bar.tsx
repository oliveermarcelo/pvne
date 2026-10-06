"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gavel, Home, LayoutGrid, LogIn, Search, Store, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof Home; match: (p: string) => boolean; badge?: number };

/** Barra de abas inferior no celular — navegação de app, sempre ao alcance do polegar */
export function TabBar({ loggedIn, pendingOrders = 0 }: { loggedIn: boolean; pendingOrders?: number }) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/", label: "Início", icon: Home, match: (p) => p === "/" },
    { href: "/marketplace", label: "Explorar", icon: Search, match: (p) => p.startsWith("/marketplace") || p.startsWith("/cards") || p.startsWith("/categorias") },
    { href: "/leiloes", label: "Leilões", icon: Gavel, match: (p) => p.startsWith("/leiloes") },
    ...(loggedIn
      ? [
          { href: "/conta/pedidos", label: "Pedidos", icon: Store, match: (p: string) => p.startsWith("/conta/pedidos"), badge: pendingOrders },
          { href: "/conta", label: "Conta", icon: User, match: (p: string) => p.startsWith("/conta") && !p.startsWith("/conta/pedidos") },
        ]
      : [
          { href: "/categorias", label: "Categorias", icon: LayoutGrid, match: () => false },
          { href: "/entrar", label: "Entrar", icon: LogIn, match: (p: string) => p.startsWith("/entrar") || p.startsWith("/cadastro") },
        ]),
  ];
  return (
    <nav
      data-tabbar
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-400/15 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map((it) => {
          const active = it.match(path);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", active ? "text-gold-300" : "text-mist-400 active:text-mist-100")}
              >
                {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-gold-400 to-gold-500" aria-hidden />}
                <span className="relative">
                  <it.icon className={cn("h-[22px] w-[22px]", active && "drop-shadow-[0_0_8px_rgba(251,219,2,0.45)]")} strokeWidth={active ? 2.4 : 2} />
                  {!!it.badge && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white num">{it.badge > 9 ? "9+" : it.badge}</span>
                  )}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
