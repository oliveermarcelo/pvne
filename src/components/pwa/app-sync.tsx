"use client";

import { useEffect } from "react";

/**
 * Para usuários logados:
 *  - mostra o número de avisos não lidos no ícone do app (Android/Windows/macOS e iPhone com app instalado);
 *  - se este aparelho já tem push ativado, reassocia a inscrição à sessão atual
 *    (ex.: depois de sair e entrar de novo, ou trocar a senha).
 */
export function AppSync({ unread }: { unread: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (nav.setAppBadge) (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem("pvne:push-synced")) return;
    } catch {
      /* sem sessionStorage: sincroniza mesmo assim */
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return;
        const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        if (res.ok) {
          try {
            sessionStorage.setItem("pvne:push-synced", "1");
          } catch {
            /* ignora */
          }
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
