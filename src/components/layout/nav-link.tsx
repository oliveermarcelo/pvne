"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, children, className }: { href: string; exact?: boolean; children: ReactNode; className?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition",
        active ? "bg-brand-500/15 text-gold-300" : "text-mist-300 hover:bg-brand-400/10 hover:text-mist-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Link de menu lateral (área do usuário / admin) */
export function SideLink({ href, exact, children, icon }: { href: string; exact?: boolean; children: ReactNode; icon?: ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-brand-500/20 font-semibold text-gold-300 ring-1 ring-brand-400/30" : "text-mist-400 hover:bg-brand-400/10 hover:text-mist-100",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
