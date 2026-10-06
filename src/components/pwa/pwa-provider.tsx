"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { InstallBanner } from "./install-banner";
import { isStandalone, markInstalled, setInstallPrompt, type InstallPromptEvent } from "./pwa-store";

/**
 * Liga os recursos de app (PWA): registra o service worker, guarda o convite de instalação,
 * avisa quando a internet cai e, no app instalado, permite "puxar para atualizar".
 */
export function PwaProvider() {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    document.documentElement.toggleAttribute("data-standalone", isStandalone());

    if ("serviceWorker" in navigator) {
      const url = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
      const register = () => navigator.serviceWorker.register(url, { scope: "/", updateViaCache: "none" }).catch((e) => console.warn("[pwa] service worker:", e));
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // nós mostramos o convite no momento certo
      setInstallPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => markInstalled();
    const net = () => setOnline(navigator.onLine);
    net();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);

  return (
    <>
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-warn px-4 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-xs font-semibold text-ink-950">
          <WifiOff className="h-3.5 w-3.5" /> Sem conexão — lances e propostas ficam bloqueados até a internet voltar.
        </div>
      )}
      {standalone && <PullToRefresh />}
      <InstallBanner />
    </>
  );
}

/** "Puxar para atualizar" no app instalado (lá não existe o botão de recarregar do navegador) */
function PullToRefresh() {
  const router = useRouter();
  const path = usePathname();
  const [pull, setPull] = useState(0);
  const [pending, start] = useTransition();
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const THRESHOLD = 70;

  useEffect(() => {
    const down = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      if (window.scrollY > 0 || e.touches.length !== 1 || t?.closest("input,textarea,select,[role=dialog],[data-no-ptr],details[open]")) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]!.clientY;
    };
    const move = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0]!.clientY - startY.current;
      if (window.scrollY > 0 || dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(dy * 0.5, 110);
      setPull(pullRef.current);
    };
    const up = () => {
      if (startY.current !== null && pullRef.current >= THRESHOLD) start(() => router.refresh());
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [router, path]);

  if (!pull && !pending) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{ transform: `translateY(calc(env(safe-area-inset-top) + ${pending ? 72 : pull}px))`, transition: pull ? "none" : "transform .2s" }}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-full border border-brand-400/30 bg-ink-800 shadow-card ${ready || pending ? "text-gold-300" : "text-mist-400"}`}>
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" style={{ transform: `rotate(${pull * 3}deg)` }} />}
      </span>
    </div>
  );
}
