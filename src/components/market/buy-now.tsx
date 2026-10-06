"use client";

import { useState, useTransition } from "react";
import { ShoppingBag } from "lucide-react";
import { buyNowAction } from "@/app/actions/market";
import { buttonClass } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";

export function BuyNowButton({ listingId, priceCents, shippingCents = 0, variant = "primary" }: { listingId: string; priceCents: number; shippingCents?: number; variant?: "primary" | "outline" }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className={buttonClass(variant, "lg", "w-full")}>
        <ShoppingBag className="h-4 w-4" /> Comprar por {formatBRL(priceCents)}
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4">
      <p className="text-sm text-mist-200">
        Confirmar a compra por <b className="text-gold-200 num">{formatBRL(priceCents + shippingCents)}</b>{shippingCents ? ` (com frete de ${formatBRL(shippingCents)})` : ""}? Em seguida você paga via PIX para a PVNE; o vendedor envia depois da confirmação do pagamento.
      </p>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await buyNowAction(listingId, priceCents);
              if (r?.error) setError(r.error);
            })
          }
          className={buttonClass("primary", "md", "flex-1")}
        >
          {pending ? "Confirmando…" : "Confirmar compra"}
        </button>
        <button type="button" onClick={() => setConfirm(false)} className={buttonClass("ghost", "md")}>Cancelar</button>
      </div>
    </div>
  );
}
