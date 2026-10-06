"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/server/errors";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão de ação com confirmação em dois passos (sem diálogos do navegador).
 * Chama uma Server Action sem formulário e exibe o erro/sucesso inline.
 */
export function ConfirmButton({
  action,
  children,
  confirmText = "Confirmar",
  question = "Tem certeza?",
  variant = "secondary",
  size = "sm",
  className,
  skipConfirm,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  confirmText?: string;
  question?: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  className?: string;
  skipConfirm?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const router = useRouter();

  const exec = () =>
    start(async () => {
      const r = await action();
      setResult(r);
      setAsking(false);
      if (r?.ok) router.refresh();
    });

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      {asking ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-xs text-mist-300">{question}</span>
          <button type="button" onClick={exec} disabled={pending} className={buttonClass(variant === "danger" ? "danger" : "primary", "sm")}>
            {pending ? "Aguarde…" : confirmText}
          </button>
          <button type="button" onClick={() => setAsking(false)} className={buttonClass("ghost", "sm")}>
            Voltar
          </button>
        </span>
      ) : (
        <button type="button" disabled={pending} onClick={() => (skipConfirm ? exec() : setAsking(true))} className={buttonClass(variant, size)}>
          {pending ? "Aguarde…" : children}
        </button>
      )}
      {result?.error && <span className="text-xs text-bad">{result.error}</span>}
      {result?.ok && result.message && <span className="text-xs text-ok">{result.message}</span>}
    </span>
  );
}
