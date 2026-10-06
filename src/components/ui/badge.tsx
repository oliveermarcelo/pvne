import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "gold" | "holo" | "ok" | "warn" | "bad" | "violet" | "cyan" | "blue";
const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-mist-300 border-white/10",
  gold: "bg-gold-400/10 text-gold-300 border-gold-400/25",
  holo: "bg-holo text-brand-800 border-transparent",
  blue: "bg-brand-500/20 text-brand-200 border-brand-400/40",
  ok: "bg-ok/10 text-ok border-ok/25",
  warn: "bg-warn/10 text-warn border-warn/25",
  bad: "bg-bad/10 text-bad border-bad/25",
  violet: "bg-brand-500/20 text-brand-200 border-brand-400/40",
  cyan: "bg-holo-cyan/10 text-holo-cyan border-holo-cyan/25",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", tones[tone], className)}>
      {children}
    </span>
  );
}

export const LISTING_TONE = { DIRECT_SALE: "gold", NEGOTIATION: "cyan", AUCTION: "violet" } as const;
