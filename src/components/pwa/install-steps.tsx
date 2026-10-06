import { EllipsisVertical, MonitorDown, PlusSquare, Share } from "lucide-react";
import type { ReactNode } from "react";
import type { Platform } from "./pwa-store";
import { cn } from "@/lib/utils";

const STEPS: Record<Platform, { title: string; steps: ReactNode[] }> = {
  ios: {
    title: "No iPhone / iPad (Safari)",
    steps: [
      <>Toque em <Kbd><Share className="h-3.5 w-3.5" /> Compartilhar</Kbd> na barra do Safari.</>,
      <>Role a lista e toque em <Kbd><PlusSquare className="h-3.5 w-3.5" /> Adicionar à Tela de Início</Kbd>.</>,
      <>Confirme em <b>Adicionar</b>. O ícone da PVNE aparece junto com seus apps.</>,
    ],
  },
  "ios-other-browser": {
    title: "No iPhone (Chrome, Firefox ou Edge)",
    steps: [
      <>Toque em <Kbd><Share className="h-3.5 w-3.5" /> Compartilhar</Kbd> (na barra de endereço ou no menu).</>,
      <>Escolha <Kbd><PlusSquare className="h-3.5 w-3.5" /> Adicionar à Tela de Início</Kbd>.</>,
      <>Não encontrou a opção? Abra este endereço no <b>Safari</b> e siga os mesmos passos.</>,
    ],
  },
  "in-app": {
    title: "Você está no navegador de outro app",
    steps: [
      <>Toque em <Kbd><EllipsisVertical className="h-3.5 w-3.5" /> menu</Kbd> e escolha <b>Abrir no navegador</b> (Safari ou Chrome).</>,
      <>No navegador, use <b>Adicionar à Tela de Início</b> (iPhone) ou <b>Instalar app</b> (Android).</>,
    ],
  },
  android: {
    title: "No Android (Chrome, Edge ou Samsung Internet)",
    steps: [
      <>Toque no menu <Kbd><EllipsisVertical className="h-3.5 w-3.5" /></Kbd> do navegador.</>,
      <>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</>,
      <>Confirme em <b>Instalar</b>. Pronto: o app abre em tela cheia.</>,
    ],
  },
  desktop: {
    title: "No computador (Chrome ou Edge)",
    steps: [
      <>Clique no ícone <Kbd><MonitorDown className="h-3.5 w-3.5" /> Instalar</Kbd> no fim da barra de endereço.</>,
      <>Ou abra o menu <Kbd><EllipsisVertical className="h-3.5 w-3.5" /></Kbd> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar PVNE Cards</b>.</>,
    ],
  },
};

export function InstallSteps({ platform, compact }: { platform: Platform; compact?: boolean }) {
  const s = STEPS[platform];
  return (
    <div>
      {!compact && <p className="mb-3 text-sm font-semibold text-mist-100">{s.title}</p>}
      <ol className="space-y-2.5">
        {s.steps.map((step, i) => (
          <li key={i} className={cn("flex gap-3 text-mist-300", compact ? "text-xs" : "text-sm")}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/25 text-[11px] font-bold text-gold-300">{i + 1}</span>
            <span className="pt-0.5 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 align-middle text-[0.92em] font-semibold text-mist-100">{children}</span>;
}

export const ALL_PLATFORMS: Platform[] = ["ios", "android", "desktop", "ios-other-browser", "in-app"];
