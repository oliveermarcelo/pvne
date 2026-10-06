import type { Metadata } from "next";
import { loadSettings } from "@/server/settings";
import { adminSaveSettingsAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/forms/inputs";
import { PIX_KEY_TYPE_LABELS } from "@/lib/labels";
import { ImageUploader } from "@/components/forms/image-uploader";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Configurações · Admin" };

export default async function AdminSettingsPage() {
  const s = await loadSettings();
  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" />
      <ActionForm action={adminSaveSettingsAction} className="max-w-3xl space-y-6">
        <section className="surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Identidade</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="site_name" label="Nome da plataforma"><Input name="site_name" defaultValue={s.site_name} /></Field>
            <Field name="contact_email" label="E-mail de contato"><Input name="contact_email" defaultValue={s.contact_email} /></Field>
          </div>
          <Field name="site_tagline" label="Slogan"><Input name="site_tagline" defaultValue={s.site_tagline} /></Field>
        </section>
        <section className="surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Marca d'água do topo da home</h2>
          <p className="text-xs text-mist-400">Opcional. A imagem aparece bem suave (≈13%, em tons de azul) atrás do leque de cards, somando-se ao padrão gráfico da PVNE. Use apenas imagens próprias ou licenciadas — personagens e logos de franquias são protegidos por direitos autorais.</p>
          <input type="hidden" name="_has_hero_watermark" value="1" />
          <ImageUploader name="hero_watermark_url" initial={s.hero_watermark_url ? [s.hero_watermark_url] : []} max={1} folder="site" aspect="wide" />
        </section>
        <section className="surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Comunidade</h2>
          <Field name="whatsapp_group_url" label="Link do grupo do WhatsApp" hint="Botão “Entrar no grupo”."><Input name="whatsapp_group_url" defaultValue={s.whatsapp_group_url} /></Field>
          <Field name="whatsapp_group_text" label="Texto do convite"><Textarea name="whatsapp_group_text" defaultValue={s.whatsapp_group_text} rows={2} /></Field>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field name="instagram_url" label="Link do Instagram" hint="Botão “Seguir no Instagram”."><Input name="instagram_url" defaultValue={s.instagram_url} /></Field>
            <Field name="instagram_handle" label="@ do Instagram"><Input name="instagram_handle" defaultValue={s.instagram_handle} /></Field>
          </div>
        </section>
        <section className="surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Pagamentos e comissão</h2>
          <p className="text-xs text-mist-400">Os compradores pagam via PIX para esta conta. O QR Code e o “copia e cola” de cada pedido são gerados com estes dados.</p>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field name="pix_key_type" label="Tipo da chave">
              <Select name="pix_key_type" defaultValue={s.pix_key_type}>
                {Object.entries(PIX_KEY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field name="pix_key" label="Chave PIX da PVNE"><Input name="pix_key" defaultValue={s.pix_key} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="pix_holder_name" label="Nome do favorecido" hint="Até 25 caracteres, como no banco."><Input name="pix_holder_name" defaultValue={s.pix_holder_name} maxLength={25} /></Field>
            <Field name="pix_city" label="Cidade do favorecido"><Input name="pix_city" defaultValue={s.pix_city} maxLength={15} /></Field>
            <Field name="pix_bank_name" label="Banco (exibido ao comprador)"><Input name="pix_bank_name" defaultValue={s.pix_bank_name} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="commission_percent" label="Comissão padrão (%)" hint="Sobre o valor do item, descontada do vendedor. Categorias podem ter % próprio."><Input name="commission_percent" defaultValue={s.commission_percent} inputMode="decimal" /></Field>
            <Field name="payment_deadline_hours" label="Prazo para pagar (horas)" hint="Depois disso o pedido é cancelado."><Input name="payment_deadline_hours" type="number" min={1} defaultValue={s.payment_deadline_hours} /></Field>
            <Field name="auto_confirm_days" label="Confirmação automática (dias)" hint="Dias após o envio sem reclamação."><Input name="auto_confirm_days" type="number" min={1} defaultValue={s.auto_confirm_days} /></Field>
          </div>
        </section>
        <section className="surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Regras de leilão</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="auction_ending_soon_minutes" label="Aviso de “acabando” (minutos antes)"><Input name="auction_ending_soon_minutes" type="number" min={0} defaultValue={s.auction_ending_soon_minutes} /></Field>
            <Field name="auction_antisniping_minutes" label="Anti-sniping (minutos)" hint="Lance nos últimos N minutos prorroga o fim por N minutos. 0 = desligado."><Input name="auction_antisniping_minutes" type="number" min={0} defaultValue={s.auction_antisniping_minutes} /></Field>
            <Field name="auction_min_duration_hours" label="Duração mínima (horas)"><Input name="auction_min_duration_hours" type="number" min={0} defaultValue={s.auction_min_duration_hours} /></Field>
            <Field name="auction_max_duration_days" label="Duração máxima (dias)"><Input name="auction_max_duration_days" type="number" min={1} defaultValue={s.auction_max_duration_days} /></Field>
          </div>
        </section>
        <SubmitButton size="lg">Salvar configurações</SubmitButton>
      </ActionForm>
    </>
  );
}
