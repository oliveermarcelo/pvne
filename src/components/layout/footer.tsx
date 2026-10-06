import Link from "next/link";
import { Instagram, MessageCircle } from "lucide-react";
import { getSettings } from "@/server/settings";
import { listActiveCategories } from "@/server/modules/categories";
import { Logo } from "./logo";

export async function Footer() {
  const [settings, categories] = await Promise.all([getSettings(), listActiveCategories()]);
  const cols = [
    {
      title: "Plataforma",
      links: [
        { href: "/marketplace", label: "Marketplace" },
        { href: "/leiloes", label: "Leilões" },
        { href: "/categorias", label: "Categorias" },
        { href: "/como-funciona", label: "Como funciona" },
        { href: "/instalar", label: "Instalar o app" },
      ],
    },
    {
      title: "Institucional",
      links: [
        { href: "/quem-somos", label: "Quem Somos" },
        { href: "/contato", label: "Contato" },
        { href: "/contato?tipo=sugestao", label: "Sugestões" },
        { href: "/contato?tipo=reclamacao", label: "Reclamações" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/termos", label: "Termos de Uso" },
        { href: "/privacidade", label: "Política de Privacidade" },
      ],
    },
  ];
  return (
    <footer className="mt-16 border-t sm:mt-24 border-brand-400/15 bg-gradient-to-b from-ink-950/40 to-brand-800/20">
      <div className="container grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Logo name={settings.site_name} height={72} />
          <p className="mt-4 max-w-xs text-sm text-mist-400">{settings.site_tagline}. Compre, venda, negocie e dispute cards raros com uma comunidade que entende do assunto.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={settings.whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/10 px-3 py-2 text-xs font-semibold text-ok hover:bg-ok/20">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-holo-rose/25 bg-holo-rose/10 px-3 py-2 text-xs font-semibold text-holo-rose hover:bg-holo-rose/20">
              <Instagram className="h-4 w-4" /> Instagram
            </a>
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-mist-500">{c.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-0.5 text-sm text-mist-300 hover:text-gold-200">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04]">
        <div className="container flex flex-col gap-3 py-6 text-xs text-mist-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.site_name}. Todos os direitos reservados.</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {categories.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/categorias/${c.slug}`} className="hover:text-mist-300">{c.name}</Link>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
