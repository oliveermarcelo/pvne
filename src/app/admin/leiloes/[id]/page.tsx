import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { effectiveAuctionStatus, nextMinimumBid } from "@/server/modules/auctions";
import { adminCancelAuctionAction, adminCloseAuctionAction, adminUpdateAuctionAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, MoneyInput } from "@/components/forms/inputs";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Table, Td } from "@/components/admin/table";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { centsToInput, formatBRL } from "@/lib/money";
import { formatDateTime, toLocalInput } from "@/lib/dates";
import { AUCTION_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Leilão · Admin" };

export default async function AdminAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.auction.findUnique({
    where: { id },
    include: {
      listing: { include: { card: { select: { id: true, name: true } } } },
      seller: { select: { id: true, username: true } },
      winner: { select: { id: true, username: true } },
      currentBidder: { select: { username: true } },
      bids: { orderBy: { createdAt: "desc" }, include: { bidder: { select: { id: true, username: true } } } },
      orders: { select: { id: true } },
    },
  });
  if (!a) notFound();
  const st = effectiveAuctionStatus(a);
  const open = a.status === "ACTIVE" || a.status === "SCHEDULED";

  return (
    <>
      <PageHeader
        eyebrow="Leilão"
        title={a.listing.card.name}
        description={<><Badge tone={st === "ACTIVE" ? "bad" : "neutral"}>{st === "ENDED_PENDING" ? "Apurando" : AUCTION_STATUS_LABELS[st]}</Badge> · vendedor <Link href={`/admin/usuarios/${a.seller.id}`} className="link">@{a.seller.username}</Link> · <Link href={`/leiloes/${a.id}`} className="link">ver no site</Link></>}
        actions={
          open && (
            <ConfirmButton action={adminCloseAuctionAction.bind(null, a.id)} variant="secondary" question="Encerrar agora? O maior lance vence." confirmText="Encerrar agora">
              Encerrar agora
            </ConfirmButton>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <DefinitionList
              items={[
                { label: "Lance inicial", value: formatBRL(a.startingBidCents) },
                { label: "Incremento mínimo", value: formatBRL(a.minIncrementCents) },
                { label: "Reserva", value: a.reservePriceCents ? formatBRL(a.reservePriceCents) : "Sem reserva" },
                { label: "Lance atual", value: formatBRL(a.currentBidCents) },
                { label: "Próximo mínimo", value: open ? formatBRL(nextMinimumBid(a)) : "—" },
                { label: "Líder", value: a.currentBidder ? `@${a.currentBidder.username}` : "—" },
                { label: "Início", value: formatDateTime(a.startsAt) },
                { label: "Encerramento", value: formatDateTime(a.endsAt) },
                { label: "Vencedor", value: a.winner ? `@${a.winner.username}` : "—" },
                ...(a.cancelReason ? [{ label: "Motivo do cancelamento", value: a.cancelReason }] : []),
                ...(a.orders[0] ? [{ label: "Pedido", value: `#${a.orders[0].id.slice(-8).toUpperCase()}` }] : []),
              ]}
            />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Histórico de lances (imutável) — {a.bids.length}</h2>
            <Table head={["Data/hora", "Usuário", "Valor", "IP"]} empty={a.bids.length === 0}>
              {a.bids.map((b) => (
                <tr key={b.id}>
                  <Td className="text-xs text-mist-400">{formatDateTime(b.createdAt)}:{String(b.createdAt.getSeconds()).padStart(2, "0")}</Td>
                  <Td><Link href={`/admin/usuarios/${b.bidder.id}`} className="hover:text-gold-200">@{b.bidder.username}</Link></Td>
                  <Td className="font-semibold num">{formatBRL(b.amountCents)}</Td>
                  <Td className="text-xs text-mist-500">{b.ip ?? "—"}</Td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
        {open && (
          <div className="space-y-4">
            <ActionForm action={adminUpdateAuctionAction.bind(null, a.id)} className="surface space-y-4 p-5">
              <h2 className="text-sm font-semibold">Editar leilão</h2>
              <Field name="endsAt" label="Encerramento"><Input name="endsAt" type="datetime-local" defaultValue={toLocalInput(a.endsAt)} /></Field>
              <Field name="startingBid" label="Lance inicial" hint={a.bidCount ? "Travado: já há lances." : undefined}><MoneyInput name="startingBid" defaultValue={centsToInput(a.startingBidCents)} readOnly={a.bidCount > 0} /></Field>
              <Field name="minIncrement" label="Incremento mínimo"><MoneyInput name="minIncrement" defaultValue={centsToInput(a.minIncrementCents)} /></Field>
              <Field name="reservePrice" label="Reserva"><MoneyInput name="reservePrice" defaultValue={centsToInput(a.reservePriceCents)} /></Field>
              <SubmitButton>Salvar alterações</SubmitButton>
            </ActionForm>
            <ActionForm action={adminCancelAuctionAction.bind(null, a.id)} className="surface space-y-3 border-bad/20 p-5">
              <h2 className="text-sm font-semibold text-bad">Cancelar leilão</h2>
              <p className="text-xs text-mist-400">Sem vencedor. Vendedor e todos os participantes são notificados. Os lances continuam registrados.</p>
              <Input name="reason" placeholder="Motivo do cancelamento" />
              <SubmitButton variant="danger" size="sm">Cancelar leilão</SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}
