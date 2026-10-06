import { BadgeCheck, Bell, Gavel, Handshake, Heart, Layers, LayoutDashboard, Library, Lock, Store, Trophy, User } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { SideLink } from "@/components/layout/nav-link";
import { ScrollNav } from "@/components/layout/scroll-nav";
import { Avatar } from "@/components/ui/misc";

const NAV = [
  { href: "/conta", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/conta/cards", label: "Meus cards", icon: Layers },
  { href: "/conta/albuns", label: "Álbuns", icon: Library },
  { href: "/conta/leiloes", label: "Meus leilões", icon: Trophy },
  { href: "/conta/lances", label: "Meus lances", icon: Gavel },
  { href: "/conta/negociacoes", label: "Negociações", icon: Handshake },
  { href: "/conta/pedidos", label: "Compras e vendas", icon: Store },
  { href: "/conta/vender", label: "Vender na PVNE", icon: BadgeCheck },
  { href: "/conta/favoritos", label: "Favoritos", icon: Heart },
  { href: "/conta/notificacoes", label: "Notificações", icon: Bell },
  { href: "/conta/perfil", label: "Perfil", icon: User },
  { href: "/conta/seguranca", label: "Senha e segurança", icon: Lock },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/conta");
  return (
    <div className="container grid grid-cols-1 gap-5 py-4 sm:gap-8 sm:py-8 lg:grid-cols-[230px_1fr] lg:py-10">
      <aside className="max-lg:sticky max-lg:top-[calc(3.5rem+3px+env(safe-area-inset-top))] max-lg:z-30 max-lg:-mx-4 max-lg:border-b max-lg:border-brand-400/10 max-lg:bg-ink-900/90 max-lg:py-2 max-lg:backdrop-blur-xl sm:max-lg:top-[calc(4rem+3px+env(safe-area-inset-top))] lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 hidden items-center gap-3 px-2 lg:flex">
          <Avatar name={user.name} src={user.avatarUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-mist-500">@{user.username}</p>
          </div>
        </div>
        <ScrollNav label="Menu da conta" className="scrollbar-none flex gap-1 overflow-x-auto px-4 lg:flex-col lg:px-0">
          {NAV.map((n) => (
            <SideLink key={n.href} href={n.href} exact={n.exact} icon={<n.icon className="h-4 w-4" />}>{n.label}</SideLink>
          ))}
        </ScrollNav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
