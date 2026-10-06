"use client";

import { Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { LinkButton } from "@/components/ui/button";
import type { ActionState } from "@/server/errors";

export function OwnerListingControls({
  editHref,
  cancelAction,
  canCancel,
  cancelHint,
}: {
  /** Página para alterar valor, tipo, frete e quantidade (ausente quando não pode mais editar) */
  editHref?: string;
  cancelAction: () => Promise<ActionState>;
  canCancel: boolean;
  cancelHint?: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-ink-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-mist-500">Você é o dono deste anúncio</p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {editHref && (
          <LinkButton href={editHref} variant="secondary">
            <Pencil className="h-4 w-4" /> Editar anúncio
          </LinkButton>
        )}
        {canCancel && (
          <ConfirmButton action={cancelAction} variant="danger" question="Encerrar este anúncio?" confirmText="Encerrar">
            Encerrar anúncio
          </ConfirmButton>
        )}
      </div>
      {!editHref && <p className="text-xs text-mist-500">Valor e forma de negociação não podem mais ser alterados.</p>}
      {!canCancel && cancelHint && <p className="text-xs text-mist-500">{cancelHint}</p>}
    </div>
  );
}
