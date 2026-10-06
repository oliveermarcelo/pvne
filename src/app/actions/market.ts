"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guards";
import { getRequestMeta } from "@/server/request";
import { formToObject } from "@/server/validation";
import type { ActionState } from "@/server/errors";
import { formatBRL } from "@/lib/money";
import * as listings from "@/server/modules/listings";
import * as auctions from "@/server/modules/auctions";
import * as negotiations from "@/server/modules/negotiations";
import * as favorites from "@/server/modules/favorites";
import { markRead } from "@/server/modules/notifications";
import { rateLimit } from "@/server/rate-limit";
import { run } from "./_run";

export async function createListingAction(cardId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    const l = await listings.createListing(user, cardId, formToObject(fd), ip);
    target = l.auctionId ? `/leiloes/${l.auctionId}` : `/cards/${cardId}`;
  });
  if (res.error) return res;
  revalidatePath("/", "layout");
  redirect(`${target}?publicado=1`);
}

export async function updateListingAction(listingId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    const r = await listings.updateListing(user.id, listingId, formToObject(fd), ip);
    target = r.auctionId ? `/leiloes/${r.auctionId}` : `/cards/${r.cardId}`;
  });
  if (res.error) return res;
  revalidatePath("/", "layout");
  redirect(`${target}?alterado=1`);
}

export async function cancelListingAction(listingId: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    // Na área do usuário, mesmo um admin age como vendedor comum (ações administrativas ficam no painel)
    await listings.cancelListing({ id: user.id, role: "USER" }, listingId);
    revalidatePath("/", "layout");
    return { ok: true, message: "Anúncio encerrado." };
  });
}

export async function updatePriceAction(listingId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await listings.updateListingPrice(user.id, listingId, fd.get("price"));
    revalidatePath("/", "layout");
    return { ok: true, message: "Preço atualizado." };
  });
}

export async function buyNowAction(listingId: string, expectedPriceCents: number): Promise<ActionState> {
  let orderId = "";
  const res = await run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    orderId = (await listings.buyNow(user.id, listingId, expectedPriceCents, ip)).id;
  });
  if (res.error) return res;
  revalidatePath("/", "layout");
  redirect(`/conta/pedidos/${orderId}`);
}

export async function placeBidAction(auctionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    rateLimit(`bid:${user.id}`, 30, 60_000);
    const r = await auctions.placeBid(user.id, auctionId, fd.get("amount"), ip);
    revalidatePath(`/leiloes/${auctionId}`);
    return {
      ok: true,
      message: `Lance de ${formatBRL(r.bid.amountCents)} registrado! Você está na frente.${r.extended ? " O encerramento foi prorrogado." : ""}`,
      data: { nextMinimum: r.nextMinimum },
    };
  });
}

export async function startNegotiationAction(listingId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    rateLimit(`neg:${user.id}`, 20, 60 * 60_000);
    id = (await negotiations.startNegotiation(user.id, listingId, formToObject(fd), ip)).id;
  });
  if (res.error) {
    const existing = res.fieldErrors?._id;
    if (existing) redirect(`/conta/negociacoes/${existing}`);
    return res;
  }
  redirect(`/conta/negociacoes/${id}`);
}

export async function respondNegotiationAction(negotiationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    rateLimit(`negmsg:${user.id}`, 60, 60 * 60_000);
    const r = await negotiations.respondNegotiation(user.id, negotiationId, formToObject(fd), ip);
    revalidatePath(`/conta/negociacoes/${negotiationId}`);
    revalidatePath("/conta/negociacoes");
    const msg = {
      ACCEPTED: "Negócio fechado! O pedido foi criado.",
      REJECTED: "Proposta recusada.",
      CANCELLED: "Negociação encerrada.",
      OPEN: "Enviado.",
    }[r.status];
    return { ok: true, message: msg };
  });
}

export async function toggleFavoriteAction(cardId: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const fav = await favorites.toggleFavorite(user.id, cardId);
    revalidatePath("/conta/favoritos");
    return { ok: true, data: fav };
  });
}

export async function markNotificationsReadAction(id?: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await markRead(user.id, id);
    revalidatePath("/", "layout");
  });
}
