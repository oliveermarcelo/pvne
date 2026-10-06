import Link from "next/link";
import { cn } from "@/lib/utils";

/** Proporção do arquivo /public/logo.svg (viewBox 1443.34 × 874.25) */
const RATIO = 1443.34 / 874.25;

/** Logo oficial da PVNE Cards (arquivo em /public/logo.svg) */
export function LogoImage({ height = 40, className, alt = "PVNE Cards", priority }: { height?: number; className?: string; alt?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt={alt}
      width={Math.round(height * RATIO)}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("block select-none drop-shadow-[0_6px_14px_rgba(2,36,184,0.35)]", className)}
      style={{ height, width: "auto" }}
      draggable={false}
    />
  );
}

export function Logo({ name = "PVNE Cards", className, height = 40 }: { name?: string; className?: string; height?: number }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center transition hover:scale-[1.03]", className)} aria-label={`${name} — início`}>
      <LogoImage height={height} alt={name} priority />
    </Link>
  );
}
