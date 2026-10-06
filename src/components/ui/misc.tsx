import Link from "next/link";
import type { ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-mist-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "ok" | "bad" | "warn"; children: ReactNode; className?: string }) {
  const t = {
    info: "border-holo-cyan/25 bg-holo-cyan/5 text-mist-200",
    ok: "border-ok/30 bg-ok/10 text-ok",
    bad: "border-bad/30 bg-bad/10 text-bad",
    warn: "border-warn/30 bg-warn/10 text-warn",
  }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", t, className)}>{children}</div>;
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-brand-400/30 bg-brand-500/15 text-gold-300">
        {icon ?? <CardsIcon className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-mist-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size} className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/10", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full bg-royal font-display font-bold text-gold-300 ring-1 ring-brand-400/40", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1.5" aria-label="Paginação">
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1]! > 1 && <span className="px-1 text-mist-500">…</span>}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn(
              "grid h-9 min-w-9 place-items-center rounded-lg px-3 text-sm num transition",
              n === page ? "bg-gold-400 font-bold text-brand-800 shadow-pop" : "text-mist-300 hover:bg-brand-400/10",
            )}
          >
            {n}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: ReactNode; key: string; count?: number }[]; active: string }) {
  return (
    <div className="scrollbar-none -mx-4 mb-6 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
            t.key === active ? "bg-brand-500/25 text-gold-300 ring-1 ring-brand-400/40" : "text-mist-400 hover:bg-brand-400/10 hover:text-mist-200",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-white/[0.08] px-1.5 text-[11px] num text-mist-300">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "gold" | "violet" | "cyan" | "ok" | "bad" }) {
  const accent = { gold: "text-gold-300", violet: "text-holo-violet", cyan: "text-holo-cyan", ok: "text-ok", bad: "text-bad" }[tone ?? "gold"];
  const body = (
    <div className="surface h-full p-5 transition hover:border-white/10">
      <p className="text-xs font-medium text-mist-400">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-semibold num", accent)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-mist-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-mist-500">{i.label}</dt>
          <dd className="mt-0.5 truncate font-medium text-mist-200">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CardsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <rect x="7" y="3" width="12" height="16" rx="2" />
      <path d="M5 6.5 4.2 7a2 2 0 0 0-.7 2.7l5.5 9.6a2 2 0 0 0 2.7.8l.8-.4" />
    </svg>
  );
}
