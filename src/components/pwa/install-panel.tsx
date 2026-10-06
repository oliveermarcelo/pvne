"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { ALL_PLATFORMS, InstallSteps } from "./install-steps";
import { detectPlatform, isStandalone, promptInstall, usePwaState, type Platform } from "./pwa-store";
import { cn } from "@/lib/utils";

const TAB_LABEL: Record<Platform, string> = {
  ios: "iPhone",
  "ios-other-browser": "iPhone (Chrome)",
  android: "Android",
  desktop: "Computador",
  "in-app": "Instagram/WhatsApp",
};

/** Instalação: botão nativo quando o navegador permite, senão o passo a passo do aparelho */
export function InstallPanel() {
  const { prompt, installed } = usePwaState();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [tab, setTab] = useState<Platform>("android");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setTab(p);
    setStandalone(isStandalone());
  }, []);

  if (standalone || installed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/10 p-5 text-sm text-ok">
        <CheckCircle2 className="h-6 w-6 shrink-0" />
        <span>{standalone ? "Você já está usando o app instalado." : "App instalado! Procure o ícone da PVNE na tela inicial."}</span>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      {prompt && (
        <div className="border-b border-white/5 p-5">
          <button onClick={() => promptInstall()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foil text-[15px] font-bold text-brand-800 shadow-pop active:translate-y-[2px] sm:w-auto sm:px-8">
            <Download className="h-5 w-5" /> Instalar o app agora
          </button>
          <p className="mt-2 text-xs text-mist-500">Leva 2 segundos e não ocupa quase nada de espaço.</p>
        </div>
      )}
      <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/5 px-3 pt-3" role="tablist" data-no-ptr>
        {ALL_PLATFORMS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={tab === p}
            onClick={() => setTab(p)}
            className={cn("shrink-0 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium", tab === p ? "border-gold-400 text-gold-300" : "border-transparent text-mist-400 hover:text-mist-100")}
          >
            {TAB_LABEL[p]}
            {platform === p && <span className="ml-1.5 rounded bg-brand-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-mist-200">você</span>}
          </button>
        ))}
      </div>
      <div className="p-5">
        <InstallSteps platform={tab} />
      </div>
    </div>
  );
}
