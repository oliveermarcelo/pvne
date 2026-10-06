import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/server/auth/guards";
import { getNegotiation } from "@/server/modules/negotiations";
import { adminInterveneAction } from "@/app/actions/admin";
import { NegotiationTimeline } from "@/components/negotiation/timeline";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Textarea } from "@/components/forms/inputs";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { NEGOTIATION_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Negociação · Admin" };

export default async function AdminNegotiationPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const n = await getNegotiation(admin, id);
  if (!n) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Negociação"
        title={n.listing.card.name}
        description={
          <>
            <Link href={`/admin/usuarios/${n.buyer.id}`} className="link">@{n.buyer.username}</Link> (comprador) × <Link href={`/admin/usuarios/${n.seller.id}`} className="link">@{n.seller.username}</Link> (vendedor) ·{" "}
            <Badge tone={n.status === "OPEN" ? "warn" : "neutral"}>{NEGOTIATION_STATUS_LABELS[n.status]}</Badge> · proposta atual {formatBRL(n.currentOfferCents)}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="surface p-5"><NegotiationTimeline messages={n.messages} viewerId={admin.id} /></div>
        <ActionForm action={adminInterveneAction.bind(null, n.id)} resetOnSuccess className="surface space-y-4 p-5 xl:self-start">
          <h2 className="text-sm font-semibold">Intervenção administrativa</h2>
          <p className="text-xs text-mist-400">A mensagem aparece destacada no histórico e as duas partes são notificadas.</p>
          <Field name="message" label="Mensagem"><Textarea name="message" rows={4} /></Field>
          {n.status === "OPEN" && <Checkbox name="close" label="Encerrar a negociação" />}
          <SubmitButton>Registrar intervenção</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
