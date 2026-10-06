"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, Loader2, Send, Smartphone } from "lucide-react";
import { detectPlatform, isStandalone } from "./pwa-store";
import { cn } from "@/lib/utils";

type Status = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.ready;
}

export async function postSubscription(sub: PushSubscription) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não foi possível ativar.");
}

/** Liga/desliga as notificações push neste aparelho */
export function PushToggle({ className, onlyWhenOff }: { className?: string; onlyWhenOff?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const platform = detectPlatform();
    if (!supported) {
      // No iPhone o push só existe com o app instalado na tela de início (iOS 16.4+)
      setStatus(platform === "ios" || platform === "ios-other-browser" ? (isStandalone() ? "unsupported" : "needs-install") : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setStatus("denied");
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    refresh().catch(() => setStatus("unsupported"));
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      if (!reg) throw new Error("O app ainda está carregando. Tente de novo em alguns segundos.");
      const { publicKey } = (await (await fetch("/api/push/key")).json()) as { publicKey: string };
      let sub = await reg.pushManager.getSubscription();
      // Chave do servidor mudou? refaz a inscrição
      const current = sub?.options.applicationServerKey;
      if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== publicKey.replace(/=+$/, "")) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      await postSubscription(sub);
      setStatus("on");
      setMsg({ tone: "ok", text: "Pronto! Este aparelho vai receber os avisos." });
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message || "Não foi possível ativar as notificações." });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = (await res.json()) as { sent?: number; error?: string };
      if (!res.ok) throw new Error(j.error);
      setMsg(j.sent ? { tone: "ok", text: "Teste enviado. Deve chegar em alguns segundos." } : { tone: "bad", text: "Nenhum aparelho recebeu. Desative e ative de novo." });
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message || "Falha no teste." });
    } finally {
      setBusy(false);
    }
  };

  // Modo "convite" (painel): só aparece enquanto o aparelho pode ativar e ainda não ativou
  if (onlyWhenOff && !msg && !(status === "off" || status === "needs-install")) return null;
  if (status === "loading") return <div className={cn("surface h-[92px] animate-pulse", className)} />;

  const on = status === "on";
  return (
    <div className={cn("surface p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3.5">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", on ? "border-ok/30 bg-ok/10 text-ok" : "border-brand-400/25 bg-brand-500/15 text-gold-300")}>
          {status === "denied" ? <BellOff className="h-5 w-5" /> : status === "needs-install" ? <Smartphone className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mist-100">{on ? "Notificações ativadas neste aparelho" : "Notificações no celular"}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-mist-400">
            {status === "needs-install" ? (
              <>No iPhone, as notificações funcionam com o app instalado. <Link href="/instalar" className="link">Veja como instalar</Link> e abra pelo ícone na tela de início.</>
            ) : status === "denied" ? (
              "As notificações foram bloqueadas para este site. Libere nas configurações do navegador (ícone de cadeado ao lado do endereço) e volte aqui."
            ) : status === "unsupported" ? (
              "Este navegador não suporta notificações push. Use Chrome, Edge, Firefox ou Safari atualizados."
            ) : on ? (
              "Você será avisado quando cobrirem seu lance, chegar proposta, o leilão acabar e o pedido andar."
            ) : (
              "Receba na hora: lance coberto, proposta recebida, leilão vencido e atualizações dos pedidos — mesmo com o app fechado."
            )}
          </p>
          {msg && <p className={cn("mt-2 text-xs font-medium", msg.tone === "ok" ? "text-ok" : "text-bad")}>{msg.text}</p>}
        </div>
      </div>
      {(status === "off" || status === "on") && (
        <div className="mt-4 flex flex-wrap gap-2 sm:pl-[58px]">
          {on ? (
            <>
              <button onClick={test} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-400/30 px-4 text-sm font-semibold text-mist-100 hover:border-gold-400/60 disabled:opacity-50">
                <Send className="h-4 w-4" /> Enviar teste
              </button>
              <button onClick={disable} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm text-mist-400 hover:bg-white/5 hover:text-bad disabled:opacity-50">
                Desativar
              </button>
            </>
          ) : (
            <button onClick={enable} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-foil px-5 text-sm font-bold text-brand-800 shadow-pop active:translate-y-[2px] disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Ativar notificações
            </button>
          )}
        </div>
      )}
    </div>
  );
}
