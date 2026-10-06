import { ArrowRightLeft, Ban, Check, MessageSquare, Shield, Sparkles, X } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  type: "OFFER" | "COUNTER_OFFER" | "ACCEPT" | "REJECT" | "CANCEL" | "MESSAGE" | "ADMIN_NOTE" | "SYSTEM";
  amountCents: number | null;
  body: string | null;
  createdAt: Date;
  author: { id: string; username: string; role: string } | null;
};

const LABEL: Record<Msg["type"], string> = {
  OFFER: "fez uma proposta",
  COUNTER_OFFER: "fez uma contraproposta",
  ACCEPT: "aceitou a proposta",
  REJECT: "recusou a proposta",
  CANCEL: "encerrou a negociação",
  MESSAGE: "",
  ADMIN_NOTE: "Administração",
  SYSTEM: "Sistema",
};

/** Histórico completo da negociação (imutável) */
export function NegotiationTimeline({ messages, viewerId }: { messages: Msg[]; viewerId: string }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const mine = m.author?.id === viewerId && m.type !== "ADMIN_NOTE";
        if (m.type === "MESSAGE") {
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-md bg-gold-400/15 text-mist-100" : "rounded-bl-md bg-ink-700 text-mist-200")}>
                {!mine && <p className="mb-0.5 text-[11px] font-semibold text-mist-400">@{m.author?.username}</p>}
                <p className="whitespace-pre-line">{m.body}</p>
                <p className="mt-1 text-right text-[10px] text-mist-500">{formatDateTime(m.createdAt)}</p>
              </div>
            </li>
          );
        }
        if (m.type === "ADMIN_NOTE" || m.type === "SYSTEM") {
          return (
            <li key={m.id} className="flex justify-center">
              <div className={cn("max-w-[90%] rounded-xl border px-4 py-2.5 text-center text-xs", m.type === "ADMIN_NOTE" ? "border-holo-violet/30 bg-holo-violet/10 text-holo-violet" : "border-white/10 bg-white/[0.03] text-mist-400")}>
                <p className="flex items-center justify-center gap-1.5 font-semibold">
                  {m.type === "ADMIN_NOTE" ? <Shield className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} {LABEL[m.type]}
                </p>
                <p className="mt-1 whitespace-pre-line">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</p>
              </div>
            </li>
          );
        }
        const Icon = m.type === "ACCEPT" ? Check : m.type === "REJECT" ? X : m.type === "CANCEL" ? Ban : m.type === "OFFER" || m.type === "COUNTER_OFFER" ? ArrowRightLeft : MessageSquare;
        const tone = m.type === "ACCEPT" ? "border-ok/30 bg-ok/10 text-ok" : m.type === "REJECT" || m.type === "CANCEL" ? "border-bad/30 bg-bad/10 text-bad" : "border-gold-400/30 bg-gold-400/10 text-gold-200";
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("flex max-w-[85%] items-center gap-3 rounded-2xl border px-4 py-3", tone)}>
              <Icon className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs">{mine ? "Você" : `@${m.author?.username}`} {LABEL[m.type]}</p>
                {m.amountCents !== null && <p className="font-display text-lg font-semibold num">{formatBRL(m.amountCents)}</p>}
                {m.body && <p className="mt-1 text-xs opacity-90">{m.body}</p>}
                <p className="mt-0.5 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
