import type { Metadata } from "next";
import { BellRing, Gavel, Maximize, Zap } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";
import { InstallPanel } from "@/components/pwa/install-panel";
import { PushToggle } from "@/components/pwa/push-toggle";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Instalar o app" };
export const dynamic = "force-dynamic";

export default async function InstallPage() {
  const [user, s] = await Promise.all([getCurrentUser(), getSettings()]);
  const perks = [
    { icon: Maximize, title: "Tela cheia, como um app", text: "Ícone na tela inicial e sem barra do navegador." },
    { icon: BellRing, title: "Avisos na hora", text: "Lance coberto, proposta recebida, pedido pago ou enviado." },
    { icon: Gavel, title: "Leilões no bolso", text: "Contador ao vivo e lance em dois toques." },
    { icon: Zap, title: "Leve e rápido", text: "Sem loja de apps, sem atualização manual — está sempre na última versão." },
  ];
  return (
    <div className="container max-w-3xl py-10 sm:py-14">
      <p className="eyebrow">App {s.site_name}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Leve a PVNE no bolso</h1>
      <p className="mt-3 text-mist-300">Instale o app direto do navegador — funciona no iPhone, no Android e no computador, sem passar pela loja de aplicativos.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {perks.map((p) => (
          <div key={p.title} className="surface-2 flex gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-400/20 bg-gold-400/10 text-gold-300">
              <p.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="mt-0.5 text-xs text-mist-400">{p.text}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Como instalar</h2>
      <InstallPanel />

      <h2 className="mb-3 mt-10 text-lg font-semibold">Notificações</h2>
      {user ? (
        <PushToggle />
      ) : (
        <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-mist-300">Entre na sua conta para ativar os avisos de lances, propostas e pedidos.</p>
          <LinkButton href="/entrar?next=/instalar" className="shrink-0">Entrar</LinkButton>
        </div>
      )}
    </div>
  );
}
