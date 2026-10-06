import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AlertTriangle, Clock, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getOrderForViewer } from "@/server/modules/orders";
import { loadSettings } from "@/server/settings";
import { confirmDeliveryAction, markShippedAction, openDisputeAction, orderMessageAction, reportPaymentAction, saveAddressAction } from "@/app/actions/orders";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/forms/inputs";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PrivateUpload } from "@/components/forms/private-upload";
import { CopyButton } from "@/components/orders/copy-button";
import { OrderSteps } from "@/components/orders/order-steps";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { AddressBlock } from "@/components/orders/address";
import { CardArt } from "@/components/cards/card-art";
import { Countdown } from "@/components/cards/countdown";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { buildPixPayload } from "@/lib/pix";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PAYOUT_STATUS_LABELS } from "@/lib/labels";
import { BR_STATES } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedido" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const o = await getOrderForViewer(user, id);
  if (!o || o.viewerRole === "admin") notFound();
  const isBuyer = o.viewerRole === "buyer";
  const settings = await loadSettings();
  const pixReady = !!settings.pix_key;

  let pix: { payload: string; qr: string } | null = null;
  if (isBuyer && o.status === "AWAITING_PAYMENT" && pixReady) {
    const payload = buildPixPayload({
      key: settings.pix_key,
      keyType: settings.pix_key_type,
      name: settings.pix_holder_name,
      city: settings.pix_city,
      amountCents: o.totalCents,
      txid: `PVNE${o.code}`,
    });
    pix = { payload, qr: await QRCode.toString(payload, { type: "svg", margin: 1, color: { dark: "#03051A", light: "#FFFFFF" } }) };
  }

  const other = isBuyer ? o.seller : o.buyer;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/conta/pedidos${isBuyer ? "" : "?tab=vendas"}`} className="text-sm text-mist-400 hover:text-mist-200">← Compras e vendas</Link>
        <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
        <Badge tone="gold">{ORDER_SOURCE_LABELS[o.source]}</Badge>
      </div>

      <div className="surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="w-20 shrink-0"><CardArt src={o.card.images[0]?.url} name={o.card.name} color={o.card.category.color} category={o.card.category.name} rounded="rounded-lg" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-mist-500">Pedido <b className="font-mono text-mist-300">#{o.code}</b> · {formatDateTime(o.createdAt)}</p>
          <h1 className="mt-1 text-xl font-semibold">{o.card.name}{o.quantity > 1 ? ` × ${o.quantity}` : ""}</h1>
          <p className="mt-1 text-sm text-mist-400">{isBuyer ? "Vendedor" : "Comprador"}: <Link href={`/colecionador/${other.username}`} className="link">@{other.username}</Link></p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-[11px] uppercase tracking-wider text-mist-500">{isBuyer ? "Total a pagar" : "Você recebe"}</p>
          <p className="font-display text-2xl font-semibold text-gold-300 num">{formatBRL(isBuyer ? o.totalCents : o.sellerNetCents)}</p>
        </div>
      </div>

      <div className="surface p-4"><OrderSteps status={o.status} showPayout={!isBuyer} /></div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* ─── Ações por etapa ─── */}
          {o.status === "CANCELLED" && <Alert tone="bad">Pedido cancelado{o.cancelReason ? `: ${o.cancelReason}` : "."}{o.refundedAt ? " O valor foi estornado ao comprador." : ""}</Alert>}
          {o.status === "DISPUTED" && <Alert tone="warn"><AlertTriangle className="mr-1 inline h-4 w-4" /> Pedido em análise pela equipe PVNE. Acompanhe e responda pela conversa abaixo.</Alert>}

          {isBuyer && o.status === "AWAITING_PAYMENT" && (
            <>
              <section className="surface space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">1. Endereço de entrega</h2>
                  {o.paymentDueAt && <span className="flex items-center gap-1.5 text-xs text-warn"><Clock className="h-3.5 w-3.5" /> pague em <Countdown to={o.paymentDueAt} className="text-warn" /></span>}
                </div>
                <ActionForm key={`${o.shipZip}-${o.shipState}-${o.shipNumber}`} action={saveAddressAction.bind(null, o.id)} className="space-y-3">
                  <Field name="shipName" label="Nome do destinatário"><Input name="shipName" defaultValue={o.shipName ?? user.name} /></Field>
                  <div className="grid gap-3 sm:grid-cols-[140px_1fr_110px]">
                    <Field name="shipZip" label="CEP"><Input name="shipZip" defaultValue={o.shipZip ?? ""} inputMode="numeric" placeholder="00000-000" /></Field>
                    <Field name="shipStreet" label="Rua"><Input name="shipStreet" defaultValue={o.shipStreet ?? ""} /></Field>
                    <Field name="shipNumber" label="Número"><Input name="shipNumber" defaultValue={o.shipNumber ?? ""} /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_90px]">
                    <Field name="shipComplement" label="Complemento"><Input name="shipComplement" defaultValue={o.shipComplement ?? ""} /></Field>
                    <Field name="shipDistrict" label="Bairro"><Input name="shipDistrict" defaultValue={o.shipDistrict ?? ""} /></Field>
                    <Field name="shipCity" label="Cidade"><Input name="shipCity" defaultValue={o.shipCity ?? ""} /></Field>
                    <Field name="shipState" label="UF"><Select name="shipState" defaultValue={o.shipState ?? ""}><option value="">—</option>{BR_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
                  </div>
                  <SubmitButton variant={o.shipZip ? "secondary" : "primary"}>{o.shipZip ? "Atualizar endereço" : "Salvar endereço"}</SubmitButton>
                </ActionForm>
              </section>

              <section className="surface space-y-4 p-5 sm:p-6">
                <h2 className="text-sm font-semibold">2. Pague via PIX para a PVNE</h2>
                {!pixReady ? (
                  <Alert tone="warn">A chave PIX da plataforma ainda não foi configurada. Aguarde o contato da equipe PVNE.</Alert>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
                    <div className="self-start rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: pix!.qr }} />
                    <div className="min-w-0 space-y-3 text-sm">
                      <p className="text-mist-300">Valor: <b className="font-display text-lg text-gold-300 num">{formatBRL(o.totalCents)}</b></p>
                      <p className="text-xs text-mist-400">Favorecido: {settings.pix_holder_name}{settings.pix_bank_name ? ` · ${settings.pix_bank_name}` : ""} · Chave ({settings.pix_key_type}): <span className="font-mono text-mist-200">{settings.pix_key}</span></p>
                      <div>
                        <label className="mb-1 block text-xs text-mist-500">PIX copia e cola</label>
                        <textarea readOnly value={pix!.payload} rows={3} className="field font-mono text-[11px]" />
                      </div>
                      <CopyButton value={pix!.payload} label="Copiar código PIX" />
                      <p className="flex items-start gap-2 text-xs text-mist-500"><ShieldCheck className="h-4 w-4 shrink-0 text-ok" /> O valor fica com a PVNE e só é repassado ao vendedor depois que você confirmar o recebimento do card.</p>
                    </div>
                  </div>
                )}
              </section>

              <section className="surface space-y-4 p-5 sm:p-6">
                <h2 className="text-sm font-semibold">3. Envie o comprovante</h2>
                <ActionForm action={reportPaymentAction.bind(null, o.id)} className="space-y-3">
                  <Field name="receipt">
                    <PrivateUpload name="receipt" folder="receipts" label="Comprovante do PIX" hint="Imagem ou PDF — visível só para você e a equipe PVNE" accept="image/jpeg,image/png,image/webp,application/pdf" />
                  </Field>
                  <SubmitButton disabled={!o.shipZip}>Já paguei — enviar comprovante</SubmitButton>
                  {!o.shipZip && <p className="text-xs text-mist-500">Salve o endereço de entrega primeiro.</p>}
                </ActionForm>
              </section>
            </>
          )}

          {isBuyer && o.status === "PAYMENT_REVIEW" && <Alert tone="info">Recebemos seu comprovante. A equipe PVNE está conferindo o pagamento — você será avisado assim que for confirmado.</Alert>}
          {isBuyer && o.status === "PAID" && <Alert tone="ok">Pagamento confirmado! O vendedor foi avisado para enviar o card.</Alert>}

          {isBuyer && o.status === "SHIPPED" && (
            <section className="surface space-y-4 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-holo-violet" /> Card enviado</h2>
              <p className="text-sm text-mist-300">{o.carrier} · rastreio <b className="font-mono text-mist-100">{o.trackingCode}</b> · enviado em {o.shippedAt && formatDateTime(o.shippedAt)}</p>
              <div className="flex flex-wrap gap-3">
                <ConfirmButton action={confirmDeliveryAction.bind(null, o.id)} variant="primary" size="md" question="Recebeu o card em ordem?" confirmText="Sim, confirmar recebimento">
                  <PackageCheck className="h-4 w-4" /> Recebi o card
                </ConfirmButton>
              </div>
              <p className="text-xs text-mist-500">Se não houver confirmação nem reclamação, o recebimento é confirmado automaticamente {settings.auto_confirm_days} dias após o envio.</p>
            </section>
          )}

          {isBuyer && ["PAYMENT_REVIEW", "PAID", "SHIPPED"].includes(o.status) && (
            <details className="surface p-5">
              <summary className="cursor-pointer text-sm font-semibold text-warn">Tenho um problema com este pedido</summary>
              <ActionForm action={openDisputeAction.bind(null, o.id)} className="mt-4 space-y-3">
                <Field name="reason" label="Descreva o que aconteceu"><Textarea name="reason" rows={4} placeholder="Ex.: o card chegou danificado, não corresponde ao anúncio, não foi enviado…" /></Field>
                <SubmitButton variant="danger">Abrir reclamação</SubmitButton>
              </ActionForm>
            </details>
          )}

          {/* Vendedor */}
          {!isBuyer && ["AWAITING_PAYMENT", "PAYMENT_REVIEW"].includes(o.status) && (
            <Alert tone="info">Aguardando o pagamento do comprador. Não envie o card antes da confirmação da PVNE — avisaremos você.</Alert>
          )}
          {!isBuyer && o.status === "PAID" && (
            <section className="surface space-y-4 p-5 sm:p-6">
              <h2 className="text-sm font-semibold">Pagamento confirmado — envie o card para:</h2>
              <AddressBlock o={o} />
              <ActionForm action={markShippedAction.bind(null, o.id)} className="grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field name="carrier" label="Transportadora"><Input name="carrier" placeholder="Correios, Jadlog…" /></Field>
                <Field name="trackingCode" label="Código de rastreio"><Input name="trackingCode" /></Field>
                <SubmitButton>Informar envio</SubmitButton>
              </ActionForm>
              <p className="text-xs text-mist-500">Embale bem (sleeve + toploader + caixa rígida). O repasse é liberado quando o comprador confirma o recebimento.</p>
            </section>
          )}
          {!isBuyer && o.status === "SHIPPED" && <Alert tone="info">Enviado por {o.carrier} (rastreio {o.trackingCode}). Aguardando o comprador confirmar o recebimento.</Alert>}
          {!isBuyer && (o.status === "DELIVERED" || o.status === "COMPLETED") && (
            <Alert tone="ok">
              {o.payoutStatus === "PAID"
                ? `Repasse de ${formatBRL(o.sellerNetCents)} realizado em ${o.payoutAt ? formatDateTime(o.payoutAt) : ""}${o.payoutReference ? ` (${o.payoutReference})` : ""}.`
                : `Entrega confirmada! O repasse de ${formatBRL(o.sellerNetCents)} será feito pela PVNE na sua chave PIX.`}
            </Alert>
          )}
          {isBuyer && (o.status === "DELIVERED" || o.status === "COMPLETED") && <Alert tone="ok">Pedido concluído — o card está na sua coleção.</Alert>}

          {/* Conversa */}
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Histórico e conversa</h2>
            <OrderTimeline events={o.events} viewerId={user.id} buyerId={o.buyerId} />
            {o.status !== "CANCELLED" && o.status !== "COMPLETED" && (
              <ActionForm action={orderMessageAction.bind(null, o.id)} resetOnSuccess className="mt-5 flex items-end gap-2 border-t border-white/5 pt-4">
                <div className="flex-1"><Textarea name="body" rows={1} maxLength={1000} placeholder="Mensagem (a equipe PVNE também vê)" className="chat-input" /></div>
                <SubmitButton variant="secondary" size="lg" pendingText="…">Enviar</SubmitButton>
              </ActionForm>
            )}
            <p className="mt-3 text-[11px] text-mist-500">Por segurança, telefones, e-mails e links externos são removidos automaticamente. Pagamentos fora da PVNE não têm garantia.</p>
          </section>
        </div>

        {/* Resumo */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="surface space-y-2 p-5 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Resumo</h2>
            <Line label="Item" value={formatBRL(o.amountCents)} />
            <Line label="Frete" value={o.shippingCents ? formatBRL(o.shippingCents) : "Grátis"} />
            <Line label="Total pago pelo comprador" value={formatBRL(o.totalCents)} strong />
            {!isBuyer && (
              <>
                <div className="my-2 border-t border-white/5" />
                <Line label={`Comissão PVNE (${(o.commissionBps / 100).toLocaleString("pt-BR")}%)`} value={`− ${formatBRL(o.feeCents)}`} />
                <Line label="Você recebe" value={formatBRL(o.sellerNetCents)} strong />
                <p className="pt-1 text-xs text-mist-500">{PAYOUT_STATUS_LABELS[o.payoutStatus]}</p>
              </>
            )}
          </div>
          {isBuyer && o.shipZip && (
            <div className="surface p-5">
              <h2 className="mb-2 text-sm font-semibold">Entrega</h2>
              <AddressBlock o={o} />
              {o.trackingCode && <p className="mt-3 text-xs text-mist-400">{o.carrier} · <span className="font-mono">{o.trackingCode}</span></p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-mist-400">{label}</span>
      <span className={strong ? "font-semibold text-gold-300 num" : "text-mist-200 num"}>{value}</span>
    </div>
  );
}
