"use client";

import { useSyncExternalStore } from "react";

/** Evento "beforeinstallprompt" (Chrome/Edge/Samsung Internet no Android e no computador) */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type State = { prompt: InstallPromptEvent | null; installed: boolean };

let state: State = { prompt: null, installed: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: State = { prompt: null, installed: false };

export function setInstallPrompt(prompt: InstallPromptEvent | null) {
  state = { ...state, prompt };
  emit();
}
export function markInstalled() {
  state = { prompt: null, installed: true };
  emit();
}

export function usePwaState(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}

/** Abre o diálogo nativo de instalação. Retorna true se o usuário aceitou. */
export async function promptInstall(): Promise<boolean> {
  const p = state.prompt;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  setInstallPrompt(null);
  if (outcome === "accepted") markInstalled();
  return outcome === "accepted";
}

export type Platform = "ios" | "ios-other-browser" | "in-app" | "android" | "desktop";

/** Detecta onde o site está aberto, para mostrar as instruções certas de instalação */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (/FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|; wv\)/i.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other-browser" : "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** O app está aberto como app instalado (tela cheia, sem barra do navegador)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
