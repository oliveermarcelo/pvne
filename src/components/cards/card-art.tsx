import { cn } from "@/lib/utils";

/**
 * Imagem do card, ou uma arte de reserva (moldura estilizada) quando não há foto.
 * Proporção de carta colecionável (63 × 88 mm).
 */
export function CardArt({
  src,
  name,
  code,
  color,
  category,
  className,
  rounded = "rounded-xl",
  priority,
  compact,
}: {
  src?: string | null;
  name: string;
  code?: string | null;
  color?: string | null;
  category?: string | null;
  className?: string;
  rounded?: string;
  priority?: boolean;
  /** Miniatura: mostra só a arte, sem textos. Padrão: automático para cantos pequenos. */
  compact?: boolean;
}) {
  const small = compact ?? (rounded === "rounded-lg" || rounded === "rounded-md");
  const accent = color || "#FBDB02";
  if (src) {
    return (
      <div className={cn("holo-frame aspect-card bg-ink-950", rounded, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={cn("holo-frame aspect-card p-[7%]", rounded, className)}
      style={{ background: `linear-gradient(150deg, ${accent}40, #0A0F33 45%, #060A26 70%, ${accent}30)` }}
      role="img"
      aria-label={name}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[10px] border border-white/10 bg-ink-950/70">
        <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 50% 38%, ${accent}55, transparent 60%)` }} />
        {!small && <div className="relative flex items-center justify-between px-[8%] pt-[7%] text-[9px] font-semibold uppercase tracking-widest text-mist-300/80">
          <span className="truncate">{category ?? "PVNE"}</span>
          {code && <span className="num text-mist-400">{code}</span>}
        </div>}
        <div className={cn("relative mx-auto grid", small ? "my-auto" : "mt-[10%]", " aspect-square w-[58%] place-items-center rounded-full border border-white/10")} style={{ background: `conic-gradient(from 200deg, ${accent}, #4F7BFF, #023EE6, #3FC5FF, ${accent})` }}>
          <div className="grid h-[82%] w-[82%] place-items-center rounded-full bg-ink-950/85">
            <span className={cn("font-display font-bold text-white/90", small ? "text-[11px]" : "text-[clamp(14px,3.2vw,26px)]")}>
              {name.replace(/[^A-Za-zÀ-ú0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </span>
          </div>
        </div>
        {!small && (
          <div className="relative mt-auto px-[8%] pb-[8%]">
            <p className="line-clamp-2 font-display text-[clamp(11px,1.6vw,14px)] font-semibold leading-tight text-white/90">{name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
