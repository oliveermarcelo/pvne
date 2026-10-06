"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { MoneyInput, Textarea } from "@/components/forms/inputs";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/server/errors";
import { formatBRL } from "@/lib/money";

export function OfferForm({ action, referenceCents }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; referenceCents: number | null }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("outline", "lg", "w-full")}>
        <Handshake className="h-4 w-4" /> Negociar
      </button>
    );
  }
  return (
    <ActionForm action={action} className="space-y-4 rounded-2xl border border-holo-cyan/25 bg-holo-cyan/5 p-4">
      <p className="text-sm font-semibold text-mist-100">Enviar proposta</p>
      <Field name="amount" label="Sua proposta" hint={referenceCents ? `Preço de referência: ${formatBRL(referenceCents)}` : undefined} required>
        <MoneyInput name="amount" autoFocus required />
      </Field>
      <Field name="message" label="Mensagem ao vendedor (opcional)">
        <Textarea name="message" rows={3} maxLength={1000} placeholder="Ex.: pago à vista, retiro em mãos…" className="min-h-[80px]" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingText="Enviando…" className="flex-1">Enviar proposta</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Cancelar</button>
      </div>
    </ActionForm>
  );
}
