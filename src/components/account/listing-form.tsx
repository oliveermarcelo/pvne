"use client";

import { useRef, useState } from "react";
import { Gavel, Handshake, Tag } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, MoneyInput, Textarea } from "@/components/forms/inputs";
import type { ActionState } from "@/server/errors";
import { cn } from "@/lib/utils";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { toLocalInput } from "@/lib/dates";

/** Encerramento sugerido: daqui a N dias, às 21h (horário de Brasília), quando há mais gente online */
function endInDays(days: number) {
  return toLocalInput(new Date(Date.now() + days * 86_400_000)).slice(0, 11) + "21:00";
}

const TYPES = [
  { v: "DIRECT_SALE", label: "Venda direta", icon: Tag, desc: "Preço fixo. Quem confirmar primeiro leva." },
  { v: "NEGOTIATION", label: "Aceitar propostas", icon: Handshake, desc: "Preço de referência e ofertas dos compradores." },
  { v: "AUCTION", label: "Leilão", icon: Gavel, desc: "Lances durante um período. Maior lance vence." },
] as const;

export function ListingForm({ action, maxQuantity, defaultType = "DIRECT_SALE", minStart, defaultEnd, commissionBps }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; maxQuantity: number; defaultType?: string; minStart: string; defaultEnd?: string; commissionBps: number }) {
  const [type, setType] = useState<string>(defaultType);
  const endRef = useRef<HTMLInputElement>(null);
  const [price, setPrice] = useState("");
  const cents = parseBRLToCents(price) ?? 0;
  const pct = commissionBps / 100;
  return (
    <ActionForm action={action} className="space-y-6">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Tipo de negociação</legend>
        {TYPES.map((t) => (
          <label
            key={t.v}
            className={cn(
              "surface cursor-pointer p-4 transition",
              type === t.v ? "border-gold-400/50 bg-gold-400/[0.06] shadow-glow" : "hover:border-white/15",
            )}
          >
            <input type="radio" name="type" value={t.v} checked={type === t.v} onChange={() => setType(t.v)} className="sr-only" />
            <t.icon className={cn("h-5 w-5", type === t.v ? "text-gold-300" : "text-mist-400")} />
            <p className="mt-3 text-sm font-semibold">{t.label}</p>
            <p className="mt-1 text-xs text-mist-400">{t.desc}</p>
          </label>
        ))}
      </fieldset>

      <section className="surface space-y-5 p-5 sm:p-6">
        {type !== "AUCTION" ? (
          <Field name="price" label={type === "NEGOTIATION" ? "Preço de referência" : "Preço de venda"} required hint={type === "NEGOTIATION" ? "Compradores podem oferecer valores até este preço, ou comprar direto por ele." : undefined}>
            <MoneyInput name="price" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field name="startingBid" label="Lance inicial" required hint="Valor do primeiro lance."><MoneyInput name="startingBid" required /></Field>
              <Field name="minIncrement" label="Incremento mínimo" required hint="Diferença mínima entre lances."><MoneyInput name="minIncrement" required /></Field>
              <Field name="reservePrice" label="Lance mínimo de reserva" hint="Opcional. Abaixo disso o card não é vendido."><MoneyInput name="reservePrice" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="startsAt" label="Início" hint="Deixe em branco para começar agora. Horário de Brasília.">
                <Input name="startsAt" type="datetime-local" min={minStart} />
              </Field>
              <Field name="endsAt" label="Encerramento" required hint="Horário de Brasília.">
                <Input ref={endRef} name="endsAt" type="datetime-local" min={minStart} defaultValue={defaultEnd} required />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[1, 3, 7, 10].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        if (endRef.current) endRef.current.value = endInDays(d);
                      }}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-mist-300 hover:border-gold-400/40 hover:text-gold-200"
                    >
                      {d === 1 ? "1 dia" : `${d} dias`}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </>
        )}
        <Field name="shipping" label="Frete (R$)" hint="Valor fixo cobrado do comprador e repassado a você integralmente. Deixe vazio para frete grátis/incluso.">
          <MoneyInput name="shipping" placeholder="0,00 (grátis)" />
        </Field>
        <p className="rounded-xl bg-ink-950/50 px-4 py-3 text-xs text-mist-400">
          Comissão PVNE: <b className="text-mist-200">{pct.toLocaleString("pt-BR")}%</b> sobre o valor do item, descontada no repasse.
          {type !== "AUCTION" && cents > 0 && (
            <> Vendendo por {formatBRL(cents)}, você recebe <b className="text-gold-300">{formatBRL(cents - Math.round((cents * commissionBps) / 10000))}</b> + frete.</>
          )}{" "}
          O pagamento é feito pelo comprador à PVNE; você envia o card depois da confirmação e recebe após a entrega.
        </p>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field name="quantity" label="Quantidade" hint={`Você tem ${maxQuantity}.`}>
            <Input name="quantity" type="number" min={1} max={maxQuantity} defaultValue={maxQuantity} />
          </Field>
          <Field name="notes" label="Observações para o comprador">
            <Textarea name="notes" rows={2} maxLength={1000} className="min-h-[46px]" placeholder="Prazo de postagem, embalagem, detalhes do card…" />
          </Field>
        </div>
      </section>

      <SubmitButton size="lg" pendingText="Publicando…">{type === "AUCTION" ? "Publicar leilão" : "Publicar anúncio"}</SubmitButton>
    </ActionForm>
  );
}
