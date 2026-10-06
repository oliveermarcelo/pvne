"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { detectPlatform, isStandalone, promptInstall, usePwaState, type Platform } from "./pwa-store";
import { InstallSteps } from "./install-steps";

const KEY = "pvne:install-dismissed";
const SNOOZE_DAYS = 14;

function dismissedRecently() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > Date.now() - SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Convite discreto para instalar o app (aparece depois de alguns segundos, some por 14 dias se fechado) */
export function InstallBanner() {
  const { prompt, installed } = usePwaState();
  const path = usePathname();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    setPlatform(detectPlatform());
    setClosed(false);
    const t = setTimeout(() => setReady(true), 12_000);
    return () => clearTimeout(t);
  }, []);

  const hiddenHere = path.startsWith("/admin") || path === "/instalar" || path.startsWith("/entrar") || path.startsWith("/cadastro");
  const canNative = !!prompt;
  const canManual = platform === "ios" || platform === "ios-other-browser" || platform === "in-app";
  if (closed || installed || !ready || hiddenHere || !(canNative || canManual)) return null;

  const dismiss = () => {
    setClosed(true);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* armazenamento indisponível: só fecha nesta visita */
    }
  };

  return (
    <div role="dialog" aria-label="Instalar o app" className="fixed inset-x-3 z-50 mx-auto max-w-md animate-[rise_.35s_ease-out] bottom-[calc(var(--tabbar,0px)+env(safe-area-inset-bottom)+0.75rem)]">
      <div className="rounded-2xl border border-brand-400/25 bg-ink-850/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pwa/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-semibold">Instale o app PVNE Cards</p>
            <p className="mt-0.5 text-xs text-mist-400">Abra direto da tela inicial, em tela cheia, e receba aviso quando cobrirem seu lance.</p>
          </div>
          <button onClick={dismiss} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-mist-500 hover:bg-white/5" aria-label="Agora não">
            <X className="h-4 w-4" />
          </button>
        </div>
        {showSteps && platform ? (
          <div className="mt-3 border-t border-white/5 pt-3">
            <InstallSteps platform={platform} compact />
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button onClick={dismiss} className="h-11 flex-1 rounded-xl text-sm font-semibold text-mist-300 hover:bg-white/5">Agora não</button>
            <button
              onClick={() => (canNative ? promptInstall().then((ok) => ok && setClosed(true)) : setShowSteps(true))}
              className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-foil text-sm font-bold text-brand-800 shadow-pop active:translate-y-[2px]"
            >
              <Download className="h-4 w-4" /> {canNative ? "Instalar" : "Como instalar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
