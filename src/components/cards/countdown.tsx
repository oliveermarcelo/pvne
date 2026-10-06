"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * Contador regressivo. `serverNow` corrige a diferença entre o relógio do
 * navegador e o do servidor (que é quem decide se o lance entra).
 */
export function Countdown({
  to,
  serverNow,
  variant = "inline",
  endedLabel = "Encerrado",
  className,
  onEnd,
}: {
  to: string | Date;
  serverNow?: string;
  variant?: "inline" | "blocks" | "compact";
  endedLabel?: string;
  className?: string;
  onEnd?: () => void;
}) {
  const target = new Date(to).getTime();
  const [offset] = useState(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0));
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);

  const left = now === null ? null : target - now;
  useEffect(() => {
    if (left !== null && left <= 0) onEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left !== null && left <= 0]);

  if (left === null) return <span className={cn("num opacity-0", className)}>--:--:--</span>;
  if (left <= 0) return <span className={cn("font-semibold text-mist-400", className)}>{endedLabel}</span>;

  const { d, h, m, s } = parts(left);
  const urgent = left < 60 * 60_000;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (variant === "blocks") {
    const cells = [
      ...(d > 0 ? [{ v: d, l: d === 1 ? "dia" : "dias" }] : []),
      { v: h, l: "horas" },
      { v: m, l: "min" },
      { v: s, l: "seg" },
    ];
    return (
      <div className={cn("flex gap-2", className)} role="timer" aria-live="off">
        {cells.map((c) => (
          <div key={c.l} className={cn("min-w-[62px] rounded-xl border px-2 py-2 text-center", urgent ? "border-bad/40 bg-bad/10" : "border-white/10 bg-ink-950/60")}>
            <div className={cn("font-display text-2xl font-semibold num", urgent ? "text-bad" : "text-mist-100")}>{pad(c.v)}</div>
            <div className="text-[10px] uppercase tracking-wider text-mist-500">{c.l}</div>
          </div>
        ))}
      </div>
    );
  }

  const text = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  return (
    <span className={cn("num font-semibold", urgent ? "text-bad" : "text-mist-100", className)} role="timer">
      {variant === "compact" ? text : text}
    </span>
  );
}
