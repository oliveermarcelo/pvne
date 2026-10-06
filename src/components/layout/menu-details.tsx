"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * <details> usado como menu suspenso que fecha sozinho ao navegar, ao tocar fora e com Esc.
 * (O cabeçalho fica montado entre as páginas, então sem isso o menu continuaria aberto.)
 */
export function MenuDetails({ className, summary, children, summaryClassName, label }: { className?: string; summary: ReactNode; children: ReactNode; summaryClassName?: string; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();

  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [path]);

  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") el.removeAttribute("open");
        return;
      }
      const t = e.target as Node;
      const summary = el.querySelector("summary");
      if (!el.contains(t)) {
        // toque fora fecha
        if (e.type === "pointerdown") el.removeAttribute("open");
      } else if (e.type === "click" && t instanceof Element && t.closest("[data-menu-close]")) {
        el.removeAttribute("open"); // fundo escurecido do menu
      } else if (e.type === "click" && t instanceof Element && t.closest("a,button[type=submit]") && !summary?.contains(t)) {
        // escolheu uma opção: deixa o clique acontecer e depois fecha
        setTimeout(() => el.removeAttribute("open"), 0);
      }
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("click", close, true);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("click", close, true);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary className={summaryClassName} aria-label={label}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
