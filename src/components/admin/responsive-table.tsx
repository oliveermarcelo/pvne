"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Copia o texto do cabeçalho de cada coluna para as células (data-label),
 * permitindo que o CSS (.rtable) mostre cada linha como cartão no celular.
 */
export function ResponsiveTable({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      const heads = [...root.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
      root.querySelectorAll("tbody tr").forEach((tr) => {
        [...tr.children].forEach((td, i) => {
          const l = heads[i] ?? "";
          if (td.getAttribute("data-label") !== l) td.setAttribute("data-label", l);
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
