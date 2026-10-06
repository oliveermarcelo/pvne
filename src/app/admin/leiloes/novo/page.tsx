import type { Metadata } from "next";
import { adminCreateAuctionAction } from "@/app/actions/admin";
import { db } from "@/server/db";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, MoneyInput, Select } from "@/components/forms/inputs";
import { PageHeader } from "@/components/ui/misc";
import { toLocalInput } from "@/lib/dates";

export const metadata: Metadata = { title: "Criar leilão · Admin" };

export default async function AdminNewAuctionPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const sp = await searchParams;
  // Cards ativos sem anúncio, para facilitar a escolha
  const cards = await db.card.findMany({
    where: { status: "ACTIVE", owner: { status: "ACTIVE" }, listings: { none: { status: "ACTIVE" } } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, name: true, owner: { select: { username: true } } },
  });
  return (
    <>
      <PageHeader eyebrow="Leilões" title="Criar leilão" description="O leilão é criado em nome do dono do card, que passa a ser o vendedor e recebe as notificações." />
      <ActionForm action={adminCreateAuctionAction} className="surface max-w-3xl space-y-5 p-5 sm:p-6">
        <Field name="cardId" label="Card" required hint="Apenas cards ativos e sem anúncio.">
          <Select name="cardId" defaultValue={sp.card ?? ""} required>
            <option value="" disabled>Selecione…</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name} — @{c.owner.username}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="startingBid" label="Lance inicial" required><MoneyInput name="startingBid" /></Field>
          <Field name="minIncrement" label="Incremento mínimo" required><MoneyInput name="minIncrement" /></Field>
          <Field name="reservePrice" label="Lance mínimo de reserva"><MoneyInput name="reservePrice" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="startsAt" label="Início" hint="Vazio = agora"><Input name="startsAt" type="datetime-local" min={toLocalInput(new Date())} /></Field>
          <Field name="endsAt" label="Encerramento" required><Input name="endsAt" type="datetime-local" min={toLocalInput(new Date())} /></Field>
          <Field name="quantity" label="Quantidade"><Input name="quantity" type="number" min={1} defaultValue={1} /></Field>
        </div>
        <SubmitButton>Criar leilão</SubmitButton>
      </ActionForm>
    </>
  );
}
