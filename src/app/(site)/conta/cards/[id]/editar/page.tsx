import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { categoryOptions } from "@/server/modules/categories";
import { getOwnedCard } from "@/server/modules/cards";
import { db } from "@/server/db";
import { deleteCardAction, saveCardAction } from "@/app/actions/catalog";
import { CardForm } from "@/components/account/card-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { LISTING_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Editar card" };

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const card = await getOwnedCard(user.id, id).catch(() => null);
  if (!card) notFound();
  const [categories, albums] = await Promise.all([categoryOptions(), db.album.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } })]);
  const l = card.listings[0];
  const locked = card.status === "BLOCKED" || (l?.type === "AUCTION" && (l.auction?.bidCount ?? 0) > 0);
  return (
    <>
      <PageHeader
        eyebrow="Coleção"
        title="Editar card"
        description={card.name}
        actions={!l && <ConfirmButton action={deleteCardAction.bind(null, card.id)} variant="danger" question="Excluir este card?" confirmText="Excluir">Excluir card</ConfirmButton>}
      />
      {locked && <Alert tone="warn" className="mb-6">{card.status === "BLOCKED" ? "Card bloqueado pela administração." : "Este card está em um leilão com lances — os dados ficam travados até o encerramento."}</Alert>}
      {l && !locked && (
        <div className="surface mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-mist-100">Anunciado: {LISTING_TYPE_LABELS[l.type]} · <span className="text-gold-300 num">{formatBRL(l.type === "AUCTION" ? l.currentPriceCents : l.priceCents)}</span></p>
            <p className="mt-0.5 text-xs text-mist-400">Aqui você edita os dados do card. Valor, frete e forma de negociação ficam em “Editar anúncio”.</p>
          </div>
          <LinkButton href={`/conta/cards/${card.id}/anuncio`} className="shrink-0">Editar anúncio</LinkButton>
        </div>
      )}
      {!l && card.status === "ACTIVE" && (
        <div className="surface mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-mist-300">Este card ainda não está à venda.</p>
          <LinkButton href={`/conta/cards/${card.id}/anunciar`} variant="secondary" className="shrink-0">Anunciar</LinkButton>
        </div>
      )}
      <CardForm
        action={saveCardAction.bind(null, card.id)}
        categories={categories}
        albums={albums}
        locked={locked}
        values={{ ...card, images: card.images.map((i) => i.url) }}
      />
    </>
  );
}
