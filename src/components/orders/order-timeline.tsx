import { Shield, Sparkles } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Ev = {
  id: string;
  type: "STATUS" | "MESSAGE" | "ADMIN_NOTE" | "SYSTEM";
  status: keyof typeof ORDER_STATUS_LABELS | null;
  body: string | null;
  createdAt: Date;
  author: { id: string; username: string; role: string } | null;
};

/** Histórico do pedido + conversa entre comprador, vendedor e PVNE */
export function OrderTimeline({ events, viewerId, buyerId }: { events: Ev[]; viewerId: string; buyerId: string }) {
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        if (e.type === "MESSAGE") {
          const mine = e.author?.id === viewerId;
          const who = e.author ? (e.author.id === buyerId ? "Comprador" : "Vendedor") : "";
          return (
            <li key={e.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-md bg-gold-400/15" : "rounded-bl-md bg-ink-700")}>
                {!mine && <p className="mb-0.5 text-[11px] font-semibold text-mist-400">{who} · @{e.author?.username}</p>}
                <p className="whitespace-pre-line text-mist-100">{e.body}</p>
                <p className="mt-1 text-right text-[10px] text-mist-500">{formatDateTime(e.createdAt)}</p>
              </div>
            </li>
          );
        }
        const admin = e.type === "ADMIN_NOTE";
        return (
          <li key={e.id} className="flex justify-center">
            <div className={cn("max-w-[92%] rounded-xl border px-4 py-2.5 text-center text-xs", admin ? "border-holo-violet/30 bg-holo-violet/10 text-holo-violet" : "border-white/10 bg-white/[0.03] text-mist-300")}>
              <p className="flex items-center justify-center gap-1.5 font-semibold">
                {admin ? <Shield className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-gold-300" />}
                {admin ? "Equipe PVNE" : e.status ? ORDER_STATUS_LABELS[e.status] : "Atualização"}
              </p>
              {e.body && <p className="mt-1 whitespace-pre-line">{e.body}</p>}
              <p className="mt-1 text-[10px] opacity-70">{formatDateTime(e.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
