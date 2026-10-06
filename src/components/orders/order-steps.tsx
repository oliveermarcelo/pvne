import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "pay", label: "Pagamento" },
  { key: "confirm", label: "Confirmação" },
  { key: "ship", label: "Envio" },
  { key: "deliver", label: "Entrega" },
  { key: "payout", label: "Repasse" },
];

const INDEX: Record<string, number> = { AWAITING_PAYMENT: 0, PAYMENT_REVIEW: 1, PAID: 2, SHIPPED: 3, DELIVERED: 4, COMPLETED: 5, PENDING: 5 };

export function OrderSteps({ status, showPayout = true }: { status: string; showPayout?: boolean }) {
  if (status === "CANCELLED" || status === "DISPUTED") return null;
  const steps = showPayout ? STEPS : STEPS.slice(0, 4);
  const current = INDEX[status] ?? 0;
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold",
                done ? "border-ok/40 bg-ok/15 text-ok" : active ? "border-gold-400/60 bg-gold-400/15 text-gold-200" : "border-white/10 text-mist-500",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("text-xs", active ? "font-semibold text-mist-100" : "text-mist-400")}>{s.label}</span>
            {i < steps.length - 1 && <span className={cn("h-px w-6 sm:w-10", done ? "bg-ok/40" : "bg-white/10")} />}
          </li>
        );
      })}
    </ol>
  );
}
