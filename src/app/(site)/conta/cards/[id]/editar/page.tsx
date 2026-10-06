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
      {l && !locked && <Alert tone="info" className="mb-6">Este card tem um anúncio ativo. As alterações aparecem imediatamente para os compradores.</Alert>}
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
