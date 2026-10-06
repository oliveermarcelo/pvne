"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Crown, Gavel, History, Lock, Trophy } from "lucide-react";
import { ActionForm, SubmitButton, useFormState } from "@/components/forms/action-form";
import { Countdown } from "@/components/cards/countdown";
import { Badge } from "@/components/ui/badge";
import type { ActionState } from "@/server/errors";
import { centsToInput, formatBRL } from "@/lib/money";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type LiveState = {
  id: string;
  status: string;
  effectiveStatus: "ACTIVE" | "SCHEDULED" | "ENDED" | "ENDED_PENDING" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  startingBidCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  nextMinimumCents: number;
  bidCount: number;
  currentBidder: { username: string } | null;
  winner: { username: string } | null;
  bids: { id: string; amountCents: number; createdAt: string; bidder: { username: string } }[];
  serverNow: string;
};

export function AuctionPanel({
  initial,
  viewer,
  isSeller,
  bidAction,
  reserveCents,
}: {
  initial: LiveState;
  viewer: { username: string } | null;
  isSeller: boolean;
  bidAction: (s: ActionState, fd: FormData) => Promise<ActionState>;
  reserveCents: number | null;
}) {
  const [state, setState] = useState(initial);
  const router = useRouter();
  const endedRefreshed = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelVisible, setPanelVisible] = useState(true);

  // Barra fixa de lance no celular quando o painel sai da tela
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPanelVisible(e!.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${initial.id}/state`, { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* rede instável: tenta no próximo ciclo */
    }
  }, [initial.id]);

  const live = state.effectiveStatus === "ACTIVE" || state.effectiveStatus === "SCHEDULED";

  useEffect(() => {
    if (!live) return;
    const tick = () => document.visibilityState === "visible" && refresh();
    const t = setInterval(tick, 4000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, refresh]);

  const onTimerEnd = () => {
    if (endedRefreshed.current) return;
    endedRefreshed.current = true;
    // O servidor encerra o leilão ao recarregar a página (e o worker em segundo plano)
    setTimeout(() => router.refresh(), 1200);
  };

  const leading = viewer && state.currentBidder?.username === viewer.username;
  const won = viewer && state.winner?.username === viewer.username;
  const reserveMet = reserveCents === null || (state.currentBidCents ?? 0) >= reserveCents;

  const showBar = !panelVisible && state.effectiveStatus === "ACTIVE" && !isSeller;
  return (
    <div className="space-y-5">
      {showBar && (
        <div className="fixed inset-x-0 z-30 border-t border-brand-400/20 bg-ink-900/95 px-4 py-2.5 backdrop-blur-xl lg:hidden bottom-[calc(var(--tabbar,0px)+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-mist-500">{state.currentBidCents ? "Lance atual" : "Lance inicial"} · <Countdown to={state.endsAt} serverNow={state.serverNow} variant="compact" /></p>
              <p className="font-display text-lg font-semibold text-gold-300 num">{formatBRL(state.currentBidCents ?? state.startingBidCents)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                setTimeout(() => document.getElementById("amount")?.focus({ preventScroll: true }), 450);
              }}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-foil px-5 text-sm font-bold text-brand-800 shadow-pop active:translate-y-[2px]"
            >
              <Gavel className="h-4 w-4" /> {leading ? "Você lidera" : "Dar lance"}
            </button>
          </div>
        </div>
      )}
      <div ref={panelRef} className="surface overflow-hidden">
        {/* Cabeçalho de status */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <StatusBadge s={state.effectiveStatus} />
          <span className="text-xs text-mist-500 num">{state.bidCount} lance{state.bidCount === 1 ? "" : "s"}</span>
        </div>

        <div className="space-y-5 p-5">
          {state.effectiveStatus === "SCHEDULED" && (
            <div>
              <p className="mb-2 text-xs text-mist-400">Começa em</p>
              <Countdown to={state.startsAt} serverNow={state.serverNow} variant="blocks" onEnd={refresh} />
              <p className="mt-2 text-xs text-mist-500">Início: {formatDateTime(state.startsAt)} · Encerramento: {formatDateTime(state.endsAt)}</p>
            </div>
          )}
          {state.effectiveStatus === "ACTIVE" && (
            <div>
              <p className="mb-2 text-xs text-mist-400">Termina em</p>
              <Countdown to={state.endsAt} serverNow={state.serverNow} variant="blocks" onEnd={onTimerEnd} />
              <p className="mt-2 text-xs text-mist-500">Encerramento: {formatDateTime(state.endsAt)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-ink-950/60 p-4">
              <p className="text-[11px] uppercase tracking-wider text-mist-500">{state.currentBidCents ? (live ? "Lance atual" : "Lance final") : "Lance inicial"}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold-300 num">{formatBRL(state.currentBidCents ?? state.startingBidCents)}</p>
              {state.currentBidder && <p className="mt-1 truncate text-xs text-mist-400">por @{state.currentBidder.username}</p>}
            </div>
            <div className="rounded-xl bg-ink-950/60 p-4">
              <p className="text-[11px] uppercase tracking-wider text-mist-500">{live ? "Próximo lance mínimo" : "Incremento"}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-mist-100 num">{formatBRL(live ? state.nextMinimumCents : state.minIncrementCents)}</p>
              <p className="mt-1 text-xs text-mist-400">incremento de {formatBRL(state.minIncrementCents)}</p>
            </div>
          </div>

          {reserveCents !== null && live && (
            <p className={cn("rounded-lg px-3 py-2 text-xs", reserveMet ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn")}>
              {reserveMet ? "Lance mínimo de reserva atingido." : "Este leilão tem lance mínimo de reserva, ainda não atingido."}
            </p>
          )}

          {/* Ação */}
          {state.effectiveStatus === "ACTIVE" ? (
            isSeller ? (
              <p className="rounded-xl border border-white/10 bg-ink-950/40 p-4 text-sm text-mist-400">Este é o seu leilão — acompanhe os lances em tempo real.</p>
            ) : !viewer ? (
              <Link href={`/entrar?next=/leiloes/${state.id}`} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foil font-semibold text-brand-800 shadow-pop">
                <Lock className="h-4 w-4" /> Entre para dar um lance
              </Link>
            ) : leading ? (
              <div className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/10 p-4 text-sm text-ok">
                <Crown className="h-5 w-5 shrink-0" /> Você tem o maior lance! Avisaremos se alguém cobrir.
              </div>
            ) : (
              <BidForm key={state.nextMinimumCents} action={bidAction} state={state} onDone={refresh} />
            )
          ) : state.effectiveStatus === "ENDED" || state.effectiveStatus === "ENDED_PENDING" ? (
            <div className={cn("rounded-xl border p-4 text-sm", won ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-white/10 bg-ink-950/40 text-mist-300")}>
              {state.effectiveStatus === "ENDED_PENDING" ? (
                "Leilão encerrado. Apurando o resultado…"
              ) : state.winner ? (
                <span className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 shrink-0 text-gold-300" />
                  {won ? (
                    <span>Parabéns! Você venceu com {formatBRL(state.currentBidCents)}. Pague o pedido via PIX em <Link href="/conta/pedidos" className="link">Compras e vendas</Link> para garantir o card.</span>
                  ) : (
                    <span>Arrematado por <b>@{state.winner.username}</b> por {formatBRL(state.currentBidCents)}.</span>
                  )}
                </span>
              ) : (
                "Leilão encerrado sem vencedor."
              )}
            </div>
          ) : state.effectiveStatus === "CANCELLED" ? (
            <p className="rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">Este leilão foi cancelado.</p>
          ) : null}
        </div>
      </div>

      {/* Histórico */}
      <div className="surface p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-mist-400" /> Histórico de lances</h3>
        {state.bids.length === 0 ? (
          <p className="text-sm text-mist-500">Nenhum lance ainda. Seja o primeiro!</p>
        ) : (
          <ol className="space-y-1">
            {state.bids.map((b, i) => (
              <li key={b.id} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", i === 0 ? "bg-gold-400/10" : "odd:bg-white/[0.02]")}>
                <span className="flex min-w-0 items-center gap-2">
                  {i === 0 ? <Crown className="h-3.5 w-3.5 shrink-0 text-gold-300" /> : <Gavel className="h-3.5 w-3.5 shrink-0 text-mist-500" />}
                  <span className={cn("truncate", viewer?.username === b.bidder.username && "font-semibold text-gold-200")}>
                    @{b.bidder.username}{viewer?.username === b.bidder.username && " (você)"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-mist-500" title={formatDateTime(b.createdAt)} suppressHydrationWarning>{timeAgo(b.createdAt)}</span>
                  <span className="font-semibold num">{formatBRL(b.amountCents)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {state.bidCount > state.bids.length && <p className="mt-3 text-xs text-mist-500">Exibindo os {state.bids.length} lances mais recentes de {state.bidCount}.</p>}
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: LiveState["effectiveStatus"] }) {
  if (s === "ACTIVE") return <Badge tone="bad"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-bad" /> Ao vivo</Badge>;
  if (s === "SCHEDULED") return <Badge tone="cyan">Em breve</Badge>;
  if (s === "CANCELLED") return <Badge tone="bad">Cancelado</Badge>;
  return <Badge>Encerrado</Badge>;
}

function BidForm({ action, state, onDone }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; state: LiveState; onDone: () => void }) {
  const [amount, setAmount] = useState(centsToInput(state.nextMinimumCents));
  const quick = [0, 1, 3].map((k) => state.nextMinimumCents + k * state.minIncrementCents);
  return (
    <ActionForm action={action} onSuccess={onDone} className="space-y-3">
      <BidFeedback />
      <label htmlFor="amount" className="block text-xs text-mist-400">Seu lance</label>
      <div className="flex flex-col gap-2 min-[400px]:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-mist-500">R$</span>
          <input id="amount" name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" className="field h-12 pl-10 text-base font-semibold num" />
        </div>
        <SubmitButton size="lg" pendingText="Enviando…"><Gavel className="h-4 w-4" /> Dar lance</SubmitButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q} type="button" onClick={() => setAmount(centsToInput(q))} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-mist-300 hover:border-gold-400/40 hover:text-gold-200 num">
            {formatBRL(q)}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-mist-500">Lances são compromissos de compra e não podem ser cancelados. O valor mínimo é validado no servidor no momento do lance.</p>
    </ActionForm>
  );
}

function BidFeedback() {
  const s = useFormState();
  return s.fieldErrors?.amount ? <p className="text-xs text-bad">{s.fieldErrors.amount}</p> : null;
}
