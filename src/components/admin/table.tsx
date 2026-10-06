import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ResponsiveTable } from "./responsive-table";

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <ResponsiveTable className="rtable surface overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-mist-500">
            {head.map((h, i) => <th key={i} className="px-4 py-3 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-mist-500">Nenhum registro encontrado.</p>}
    </ResponsiveTable>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-mist-200", className)}>{children}</td>;
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-block py-1 font-medium text-mist-100 hover:text-gold-200">{children}</Link>;
}

/** Barra de busca/filtros (GET) */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form action={action} className="mb-5 flex flex-wrap items-end gap-2 max-sm:[&>*:first-child]:!basis-full max-sm:[&>*]:!w-auto max-sm:[&>*]:min-w-0 max-sm:[&>*]:grow max-sm:[&>*]:basis-[calc(50%-0.25rem)]">
      {children}
      <button className="h-10 rounded-xl bg-ink-700 px-4 text-sm font-semibold hover:bg-ink-600">Filtrar</button>
      <Link href={action} className="grid h-10 place-items-center rounded-xl px-3 text-sm text-mist-400 hover:bg-white/5">Limpar</Link>
    </form>
  );
}
