import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getOrderForViewer } from "@/server/modules/orders";
import {
  adminCancelOrderAction,
  adminConfirmPaymentAction,
  adminPayoutAction,
  adminRejectPaymentAction,
  adminResolveDisputeAction,
  orderMessageAction,
} from "@/app/actions/orders";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Textarea } from "@/components/forms/inputs";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { OrderSteps } from "@/components/orders/order-steps";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { AddressBlock } from "@/components/orders/address";
import { CopyButton } from "@/components/orders/copy-button";
import { Alert, DefinitionList, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { maskDocument } from "@/lib/documents";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PAYOUT_STATUS_LABELS, PIX_KEY_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Pedido · Admin" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const o = await getOrderForViewer(admin, id);
  if (!o) notFound();
  const sellerProfile = await db.sellerProfile.findUnique({ where: { userId: o.sellerId } });
  const open = ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "SHIPPED", "DISPUTED"].includes(o.status);

  return (
    <>
      <PageHeader
        eyebrow={`Pedido #${o.code}`}
        title={o.card.name}
        description={
          <>
            <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge> · {ORDER_SOURCE_LABELS[o.source]} · comprador{" "}
            <Link href={`/admin/usuarios/${o.buyer.id}`} className="link">@{o.buyer.username}</Link> · vendedor{" "}
            <Link href={`/admin/usuarios/${o.seller.id}`} className="link">@{o.seller.username}</Link>
          </>
        }
      />
      <div className="surface mb-6 p-4"><OrderSteps status={o.status} /></div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-6">
          <section className="surface p-5">
            <DefinitionList
              items={[
                { label: "Item", value: formatBRL(o.amountCents) },
                { label: "Frete", value: formatBRL(o.shippingCents) },
                { label: "Total pago", value: <b className="text-gold-300">{formatBRL(o.totalCents)}</b> },
                { label: `Comissão (${o.commissionBps / 100}%)`, value: formatBRL(o.feeCents) },
                { label: "Repasse ao vendedor", value: formatBRL(o.sellerNetCents) },
                { label: "Situação do repasse", value: PAYOUT_STATUS_LABELS[o.payoutStatus] },
                { label: "Prazo de pagamento", value: o.paymentDueAt ? formatDateTime(o.paymentDueAt) : "—" },
                { label: "Comprovante enviado", value: o.paymentReportedAt ? formatDateTime(o.paymentReportedAt) : "—" },
                { label: "Pago em", value: o.paidAt ? formatDateTime(o.paidAt) : "—" },
                { label: "Envio", value: o.trackingCode ? `${o.carrier} · ${o.trackingCode}` : "—" },
                { label: "Entregue em", value: o.deliveredAt ? formatDateTime(o.deliveredAt) : "—" },
                { label: "Repasse em", value: o.payoutAt ? `${formatDateTime(o.payoutAt)} (${o.payoutReference})` : "—" },
              ]}
            />
            {o.disputeReason && <Alert tone="warn" className="mt-5">Reclamação do comprador: {o.disputeReason}</Alert>}
            {o.cancelReason && <Alert tone="bad" className="mt-5">Cancelado: {o.cancelReason}{o.refundedAt ? " (estornado)" : ""}</Alert>}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="surface p-5">
              <h2 className="mb-2 text-sm font-semibold">Entrega</h2>
              <AddressBlock o={o} />
            </div>
            <div className="surface p-5">
              <h2 className="mb-2 text-sm font-semibold">Comprovante</h2>
              {o.paymentReceiptUrl ? (
                <a href={o.paymentReceiptUrl} target="_blank" rel="noopener noreferrer" className="link text-sm">Abrir comprovante ↗</a>
              ) : (
                <p className="text-sm text-mist-500">Não enviado.</p>
              )}
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Histórico e conversa</h2>
            <OrderTimeline events={o.events} viewerId={admin.id} buyerId={o.buyerId} />
            <ActionForm action={orderMessageAction.bind(null, o.id)} resetOnSuccess className="mt-5 flex items-end gap-2 border-t border-white/5 pt-4">
              <div className="flex-1"><Textarea name="body" rows={1} placeholder="Mensagem da equipe (as duas partes veem)" className="chat-input" /></div>
              <SubmitButton variant="secondary" size="lg" pendingText="…">Enviar</SubmitButton>
            </ActionForm>
          </section>
        </div>

        <div className="space-y-4 xl:self-start">
          {(o.status === "AWAITING_PAYMENT" || o.status === "PAYMENT_REVIEW") && (
            <div className="surface space-y-3 p-5">
              <h2 className="text-sm font-semibold">Pagamento</h2>
              <p className="text-xs text-mist-400">Confira no extrato da conta PVNE um PIX de <b className="text-mist-200">{formatBRL(o.totalCents)}</b> com identificador <b className="font-mono text-mist-200">PVNE{o.code}</b>.</p>
              <ConfirmButton action={adminConfirmPaymentAction.bind(null, o.id)} variant="primary" size="md" question="Pagamento recebido?" confirmText="Confirmar pagamento">
                Confirmar pagamento recebido
              </ConfirmButton>
              {o.status === "PAYMENT_REVIEW" && (
                <ActionForm action={adminRejectPaymentAction.bind(null, o.id)} className="space-y-2 border-t border-white/5 pt-3">
                  <Input name="reason" placeholder="Motivo (ex.: PIX não localizado)" />
                  <SubmitButton variant="ghost" size="sm">Recusar comprovante</SubmitButton>
                </ActionForm>
              )}
            </div>
          )}

          {o.status === "DISPUTED" && (
            <div className="surface space-y-4 p-5">
              <h2 className="text-sm font-semibold text-warn">Resolver disputa</h2>
              <ActionForm action={adminResolveDisputeAction.bind(null, o.id, "release")} className="space-y-2">
                <Field name="note" label="Liberar ao vendedor (considera entregue)"><Input name="note" placeholder="Justificativa" /></Field>
                <SubmitButton size="sm">Liberar e transferir o card</SubmitButton>
              </ActionForm>
              <ActionForm action={adminResolveDisputeAction.bind(null, o.id, "resume")} className="space-y-2 border-t border-white/5 pt-3">
                <Field name="note" label="Retomar o fluxo normal"><Input name="note" placeholder="Justificativa" /></Field>
                <SubmitButton size="sm" variant="secondary">Retomar pedido</SubmitButton>
              </ActionForm>
              <p className="text-xs text-mist-500">Para devolver o dinheiro ao comprador, use “Cancelar pedido” marcando o estorno.</p>
            </div>
          )}

          {o.status === "DELIVERED" && o.payoutStatus === "PENDING" && (
            <div className="surface space-y-3 p-5">
              <h2 className="text-sm font-semibold">Repasse ao vendedor</h2>
              <p className="text-2xl font-display font-semibold text-gold-300 num">{formatBRL(o.sellerNetCents)}</p>
              {sellerProfile ? (
                <div className="space-y-2 text-xs text-mist-400">
                  <p>{sellerProfile.legalName} · {maskDocument(sellerProfile.document)}</p>
                  <p>PIX ({PIX_KEY_TYPE_LABELS[sellerProfile.pixKeyType]}): <span className="font-mono text-mist-200">{sellerProfile.pixKey}</span></p>
                  <CopyButton value={sellerProfile.pixKey} label="Copiar chave" />
                </div>
              ) : (
                <Alert tone="warn">Vendedor sem dados de repasse (anterior à verificação). Peça que ele envie o cadastro em “Vender na PVNE”.</Alert>
              )}
              <ActionForm action={adminPayoutAction.bind(null, o.id)} className="space-y-2 border-t border-white/5 pt-3">
                <Field name="reference" label="Identificador do PIX enviado"><Input name="reference" placeholder="ID da transação / E2E" /></Field>
                <SubmitButton>Registrar repasse</SubmitButton>
              </ActionForm>
            </div>
          )}

          {open && (
            <ActionForm action={adminCancelOrderAction.bind(null, o.id)} className="surface space-y-3 border-bad/20 p-5">
              <h2 className="text-sm font-semibold text-bad">Cancelar pedido</h2>
              <Input name="reason" placeholder="Motivo (enviado às duas partes)" />
              {o.paidAt && <Checkbox name="refunded" label="O valor já foi estornado ao comprador" />}
              <p className="text-xs text-mist-500">O card volta a ficar disponível para o vendedor anunciar.</p>
              <SubmitButton variant="danger" size="sm">Cancelar pedido</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
