"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { MoneyInput, Textarea } from "@/components/forms/inputs";
import type { ActionState } from "@/server/errors";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

/** Ações disponíveis na negociação conforme o turno */
export function NegotiationComposer({ action, myTurn, isSeller, currentCents }: { action: Action; myTurn: boolean; isSeller: boolean; currentCents: number }) {
  const [mode, setMode] = useState<"message" | "counter" | null>(null);
  return (
    <div className="space-y-4">
      {myTurn ? (
        <div className="rounded-2xl border border-warn/30 bg-warn/5 p-4">
          <p className="text-sm text-mist-200">
            Sua vez: a proposta atual é <b className="text-gold-200 num">{formatBRL(currentCents)}</b>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionForm action={action} showMessage={false}>
              <input type="hidden" name="action" value="accept" />
              <SubmitButton pendingText="Fechando…">Aceitar {formatBRL(currentCents)}</SubmitButton>
            </ActionForm>
            <button type="button" onClick={() => setMode("counter")} className={cn("h-10 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:border-gold-400/60", mode === "counter" && "border-gold-400/60 text-gold-200")}>
              {isSeller ? "Fazer contraproposta" : "Enviar nova proposta"}
            </button>
            <ActionForm action={action} showMessage={false}>
              <input type="hidden" name="action" value="reject" />
              <SubmitButton variant="danger" pendingText="…">Recusar</SubmitButton>
            </ActionForm>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-ink-950/40 p-4 text-sm text-mist-400">
          Aguardando a resposta da outra parte à proposta de <b className="text-mist-200 num">{formatBRL(currentCents)}</b>.
        </p>
      )}

      {mode === "counter" && myTurn && (
        <ActionForm action={action} onSuccess={() => setMode(null)} className="space-y-3 rounded-2xl border border-gold-400/25 bg-gold-400/5 p-4">
          <input type="hidden" name="action" value="counter" />
          <Field name="amount" label={isSeller ? "Valor da contraproposta" : "Valor da nova proposta"}><MoneyInput name="amount" autoFocus /></Field>
          <Field name="message" label="Mensagem (opcional)"><Textarea name="message" rows={2} className="min-h-[60px]" /></Field>
          <div className="flex gap-2">
            <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
            <button type="button" onClick={() => setMode(null)} className="h-10 rounded-xl px-4 text-sm text-mist-400 hover:bg-white/5">Cancelar</button>
          </div>
        </ActionForm>
      )}

      <ActionForm action={action} resetOnSuccess showMessage={false} className="flex items-end gap-2">
        <input type="hidden" name="action" value="message" />
        <div className="flex-1">
          <label htmlFor="message" className="sr-only">Mensagem</label>
          <Textarea name="message" rows={1} maxLength={1000} placeholder="Escreva uma mensagem…" className="chat-input" />
        </div>
        <SubmitButton variant="secondary" size="lg" pendingText="…">Enviar</SubmitButton>
      </ActionForm>

      <ActionForm action={action} showMessage={false}>
        <input type="hidden" name="action" value="cancel" />
        <SubmitButton variant="ghost" size="sm" pendingText="…">Desistir da negociação</SubmitButton>
      </ActionForm>
    </div>
  );
}
