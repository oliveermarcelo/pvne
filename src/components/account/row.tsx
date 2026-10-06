import Link from "next/link";
import type { ReactNode } from "react";
import { CardArt } from "@/components/cards/card-art";

/** Linha padrão de lista na área do usuário (miniatura + textos + lado direito) */
export function Row({ href, image, name, title, subtitle, meta, right }: { href: string; image?: string; name: string; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <Link href={href} className="surface flex items-center gap-4 p-3 transition hover:border-white/15 sm:p-4">
      <div className="w-12 shrink-0 sm:w-14"><CardArt src={image} name={name} rounded="rounded-lg" /></div>
      <div className="min-w-0 flex-1">
        {meta && <div className="mb-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
        <p className="truncate font-semibold">{title}</p>
        {subtitle && <p className="truncate text-xs text-mist-500">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </Link>
  );
}
