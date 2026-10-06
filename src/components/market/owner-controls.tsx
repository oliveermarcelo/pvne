"use client";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { MoneyInput } from "@/components/forms/inputs";
import { ConfirmButton } from "@/components/forms/confirm-button";
import type { ActionState } from "@/server/errors";
import { centsToInput } from "@/lib/money";

export function OwnerListingControls({
  priceAction,
  cancelAction,
  priceCents,
  canCancel,
  cancelHint,
}: {
  priceAction?: (s: ActionState, fd: FormData) => Promise<ActionState>;
  cancelAction: () => Promise<ActionState>;
  priceCents?: number | null;
  canCancel: boolean;
  cancelHint?: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-ink-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-mist-500">Você é o dono deste anúncio</p>
      {priceAction && (
        <ActionForm action={priceAction} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="price" className="mb-1.5 block text-xs text-mist-400">Alterar preço</label>
            <MoneyInput name="price" defaultValue={centsToInput(priceCents)} />
          </div>
          <SubmitButton variant="secondary" pendingText="…">Salvar</SubmitButton>
        </ActionForm>
      )}
      {canCancel ? (
        <ConfirmButton action={cancelAction} variant="danger" question="Encerrar este anúncio?" confirmText="Encerrar">
          Encerrar anúncio
        </ConfirmButton>
      ) : (
        cancelHint && <p className="text-xs text-mist-500">{cancelHint}</p>
      )}
    </div>
  );
}
