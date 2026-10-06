"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Select, Textarea } from "@/components/forms/inputs";
import { PrivateUpload } from "@/components/forms/private-upload";
import type { ActionState } from "@/server/errors";
import { PIX_KEY_TYPE_LABELS } from "@/lib/labels";
import { BR_STATES } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SellerApplicationForm({ action, defaults }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; defaults: { name: string; phone: string; city: string; state: string } }) {
  const [person, setPerson] = useState<"PF" | "PJ">("PF");
  return (
    <ActionForm action={action} className="space-y-6">
      <section className="surface space-y-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">1. Dados do vendedor</h2>
        <div className="flex gap-2">
          {(["PF", "PJ"] as const).map((p) => (
            <label key={p} className={cn("cursor-pointer rounded-xl border px-4 py-2 text-sm transition", person === p ? "border-gold-400/60 bg-gold-400/10 text-gold-200" : "border-white/10 text-mist-300 hover:border-white/20")}>
              <input type="radio" name="personType" value={p} checked={person === p} onChange={() => setPerson(p)} className="sr-only" />
              {p === "PF" ? "Pessoa física" : "Pessoa jurídica"}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="legalName" label={person === "PF" ? "Nome completo (como no documento)" : "Razão social"} required><Input name="legalName" defaultValue={person === "PF" ? defaults.name : ""} /></Field>
          <Field name="document" label={person === "PF" ? "CPF" : "CNPJ"} required><Input name="document" inputMode="numeric" placeholder={person === "PF" ? "000.000.000-00" : "00.000.000/0000-00"} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {person === "PF" && <Field name="birthDate" label="Data de nascimento" required><Input name="birthDate" type="date" /></Field>}
          <Field name="phone" label="Telefone / WhatsApp" hint="Uso interno da PVNE — não é exibido a compradores." required><Input name="phone" type="tel" defaultValue={defaults.phone} /></Field>
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">2. Endereço (de onde os cards serão enviados)</h2>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr_110px]">
          <Field name="zip" label="CEP" required><Input name="zip" inputMode="numeric" placeholder="00000-000" /></Field>
          <Field name="street" label="Rua" required><Input name="street" /></Field>
          <Field name="number" label="Número" required><Input name="number" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_90px]">
          <Field name="complement" label="Complemento"><Input name="complement" /></Field>
          <Field name="district" label="Bairro" required><Input name="district" /></Field>
          <Field name="city" label="Cidade" required><Input name="city" defaultValue={defaults.city} /></Field>
          <Field name="state" label="UF" required><Select name="state" defaultValue={defaults.state}><option value="">—</option>{BR_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">3. Chave PIX para receber os repasses</h2>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Field name="pixKeyType" label="Tipo da chave" required>
            <Select name="pixKeyType" defaultValue={person === "PF" ? "CPF" : "CNPJ"}>
              {Object.entries(PIX_KEY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field name="pixKey" label="Chave PIX" hint="A chave deve estar no nome do titular informado acima." required><Input name="pixKey" /></Field>
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">4. Verificação de identidade</h2>
        <p className="text-xs text-mist-400">Os arquivos ficam em área privada, acessível só por você e pela equipe PVNE. {person === "PJ" && "Envie o documento do responsável legal."}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="docFrontUrl"><PrivateUpload name="docFrontUrl" folder="kyc" label="Documento — frente" hint="RG ou CNH" /></Field>
          <Field name="docBackUrl"><PrivateUpload name="docBackUrl" folder="kyc" label="Documento — verso" hint="Opcional para CNH digital" /></Field>
          <Field name="selfieUrl"><PrivateUpload name="selfieUrl" folder="kyc" label="Selfie com o documento" hint="Rosto e documento visíveis" /></Field>
        </div>
        <Field name="notes" label="Observações (opcional)"><Textarea name="notes" rows={2} placeholder="Conte o que você coleciona e pretende vender." /></Field>
      </section>

      <Field name="acceptTerms">
        <Checkbox
          name="acceptTerms"
          label={<>Concordo com os <Link href="/termos" target="_blank" className="link">Termos de Uso</Link>: todas as vendas são pagas pela PVNE, a comissão é descontada no repasse e é proibido negociar fora da plataforma.</>}
        />
      </Field>
      <SubmitButton size="lg" pendingText="Enviando…">Enviar pedido para análise</SubmitButton>
    </ActionForm>
  );
}
