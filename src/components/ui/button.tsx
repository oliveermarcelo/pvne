import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "holo" | "outline" | "royal";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-foil text-brand-800 shadow-pop hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_0_#0224B8]",
  royal: "bg-royal text-white shadow-[0_3px_0_0_#090A75,0_10px_26px_-10px_rgba(2,62,230,0.7)] hover:brightness-110 active:translate-y-[2px]",
  secondary: "bg-ink-700 text-mist-100 hover:bg-ink-600 border border-brand-400/15",
  outline: "border border-brand-400/35 text-mist-100 hover:border-gold-400/70 hover:text-gold-200",
  ghost: "text-mist-300 hover:bg-brand-400/10 hover:text-mist-100",
  danger: "bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25",
  holo: "bg-holo text-brand-800 hover:brightness-110",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
