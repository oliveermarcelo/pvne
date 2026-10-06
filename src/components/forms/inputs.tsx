import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input id={p.id ?? p.name} className={cn("field", className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea id={p.id ?? p.name} className={cn("field min-h-[110px] resize-y", className)} {...p} />;
}

export function Select({ className, children, ...p }: ComponentProps<"select">) {
  return (
    <select id={p.id ?? p.name} className={cn("field appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23858BA0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...p}>
      {children}
    </select>
  );
}

/** Campo de valor em reais: aceita "1.500,00", "1500" etc. (conversão no servidor) */
export function MoneyInput({ className, ...p }: ComponentProps<"input">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-mist-500">R$</span>
      <input id={p.id ?? p.name} inputMode="decimal" autoComplete="off" placeholder="0,00" className={cn("field pl-10 num", className)} {...p} />
    </div>
  );
}

export function Checkbox({ label, className, ...p }: ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-mist-300", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-950 accent-[#FBDB02]" {...p} />
      <span>{label}</span>
    </label>
  );
}
