import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { categoryOptions } from "@/server/modules/categories";
import { adminCancelListingAction, adminSetCardStatusAction, adminUpdateCardAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Select, Textarea } from "@/components/forms/inputs";
import { CardArt } from "@/components/cards/card-art";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { CARD_STATUS_LABELS, CONDITION_LABELS, LANGUAGES, LISTING_STATUS_LABELS, LISTING_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Card · Admin" };

export default async function AdminCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await db.card.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, name: true } },
      category: true,
      images: { orderBy: { position: "asc" } },
      listings: { orderBy: { createdAt: "desc" }, include: { auction: { select: { id: true, bidCount: true } }, orders: { select: { id: true, buyerId: true } } } },
    },
  });
  if (!card) notFound();
  const categories = await categoryOptions();
  const active = card.listings.find((l) => l.status === "ACTIVE");

  return (
    <>
      <PageHeader
        eyebrow="Card"
        title={card.name}
        description={<>Dono: <Link href={`/admin/usuarios/${card.owner.id}`} className="link">@{card.owner.username}</Link> · <Badge tone={card.status === "ACTIVE" ? "ok" : "bad"}>{CARD_STATUS_LABELS[card.status]}</Badge> · <Link href={`/cards/${card.id}`} className="link">ver no site</Link></>}
      />
      <div className="grid gap-6 xl:grid-cols-[260px_1fr_360px]">
        <div className="space-y-3">
          <CardArt src={card.images[0]?.url} name={card.name} code={card.code} color={card.category.color} category={card.category.name} />
          <div className="grid grid-cols-4 gap-2">
            {card.images.slice(1).map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i.id} src={i.url} alt="" className="aspect-card w-full rounded-md object-cover" />
            ))}
          </div>
        </div>

        <ActionForm action={adminUpdateCardAction.bind(null, card.id)} className="surface space-y-4 p-5">
          <h2 className="text-sm font-semibold">Editar dados do card</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Nome"><Input name="name" defaultValue={card.name} /></Field>
            <Field name="code" label="Código"><Input name="code" defaultValue={card.code ?? ""} /></Field>
            <Field name="categoryId" label="Categoria"><Select name="categoryId" defaultValue={card.categoryId}>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
            <Field name="condition" label="Estado"><Select name="condition" defaultValue={card.condition}>{Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            <Field name="setName" label="Coleção"><Input name="setName" defaultValue={card.setName ?? ""} /></Field>
            <Field name="edition" label="Edição"><Input name="edition" defaultValue={card.edition ?? ""} /></Field>
            <Field name="rarity" label="Raridade"><Input name="rarity" defaultValue={card.rarity ?? ""} /></Field>
            <Field name="language" label="Idioma"><Select name="language" defaultValue={card.language ?? ""}><option value="">—</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</Select></Field>
            <Field name="quantity" label="Quantidade"><Input name="quantity" type="number" defaultValue={card.quantity} /></Field>
          </div>
          <Field name="description" label="Descrição"><Textarea name="description" defaultValue={card.description ?? ""} rows={4} /></Field>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>

        <div className="space-y-4">
          <div className="surface space-y-3 p-5">
            <h2 className="text-sm font-semibold">Moderação</h2>
            {card.status !== "BLOCKED" && (
              <ActionForm action={adminSetCardStatusAction.bind(null, card.id, "BLOCKED")} className="space-y-2">
                <Input name="reason" placeholder="Motivo do bloqueio (enviado ao dono)" />
                <SubmitButton variant="danger" size="sm">Bloquear card e anúncios</SubmitButton>
              </ActionForm>
            )}
            {card.status !== "ACTIVE" && (
              <ActionForm action={adminSetCardStatusAction.bind(null, card.id, "ACTIVE")}>
                <SubmitButton variant="secondary" size="sm">Reativar card</SubmitButton>
              </ActionForm>
            )}
            {card.status !== "REMOVED" && (
              <ActionForm action={adminSetCardStatusAction.bind(null, card.id, "REMOVED")}>
                <SubmitButton variant="ghost" size="sm">Remover do site</SubmitButton>
              </ActionForm>
            )}
          </div>
          {active && (
            <ActionForm action={adminCancelListingAction.bind(null, active.id)} className="surface space-y-3 p-5">
              <h2 className="text-sm font-semibold">Anúncio ativo: {LISTING_TYPE_LABELS[active.type]} · {formatBRL(active.currentPriceCents)}</h2>
              <Input name="reason" placeholder="Motivo (notificado ao vendedor e interessados)" />
              <Checkbox name="block" label="Bloquear anúncio (em vez de apenas cancelar)" />
              <SubmitButton variant="danger" size="sm">Encerrar anúncio</SubmitButton>
            </ActionForm>
          )}
          <div className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Histórico de anúncios</h2>
            <ul className="space-y-2 text-xs">
              {card.listings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>{LISTING_TYPE_LABELS[l.type]} · {formatDateTime(l.createdAt)}</span>
                  <span className="flex items-center gap-2">
                    {l.auction && <Link href={`/admin/leiloes/${l.auction.id}`} className="link">leilão</Link>}
                    <Badge tone={l.status === "ACTIVE" ? "ok" : "neutral"}>{LISTING_STATUS_LABELS[l.status]}</Badge>
                  </span>
                </li>
              ))}
              {card.listings.length === 0 && <li className="text-mist-500">Nunca anunciado.</li>}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
