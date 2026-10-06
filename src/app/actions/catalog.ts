"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guards";
import { formToObject } from "@/server/validation";
import type { ActionState } from "@/server/errors";
import * as albums from "@/server/modules/albums";
import * as cards from "@/server/modules/cards";
import { run } from "./_run";

// ─── Álbuns ───────────────────────────────────────────────────

export async function saveAlbumAction(albumId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  let id = albumId;
  const res = await run(async () => {
    const user = await requireUser();
    const input = formToObject(fd);
    if (albumId) await albums.updateAlbum(user.id, albumId, input);
    else id = (await albums.createAlbum(user.id, input)).id;
  });
  if (res.error) return res;
  revalidatePath("/conta/albuns");
  redirect(`/conta/albuns/${id}`);
}

export async function deleteAlbumAction(albumId: string): Promise<ActionState> {
  const res = await run(async () => {
    const user = await requireUser();
    await albums.deleteAlbum(user.id, albumId);
  });
  if (res.error) return res;
  revalidatePath("/conta/albuns");
  redirect("/conta/albuns");
}

export async function moveCardsAction(cardIds: string[], albumId: string | null): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const n = await albums.setCardsAlbum(user.id, cardIds, albumId);
    revalidatePath("/conta", "layout");
    return { ok: true, message: `${n} card(s) movido(s).` };
  });
}

// ─── Cards ────────────────────────────────────────────────────

export async function saveCardAction(cardId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  let id = cardId;
  const listNow = fd.get("_then") === "anunciar";
  const res = await run(async () => {
    const user = await requireUser();
    const input = formToObject(fd, ["images"]);
    if (cardId) await cards.updateCard(user.id, cardId, input);
    else id = (await cards.createCard(user.id, input)).id;
  });
  if (res.error) return res;
  revalidatePath("/conta/cards");
  revalidatePath(`/cards/${id}`);
  redirect(listNow ? `/conta/cards/${id}/anunciar` : `/conta/cards?salvo=${id}`);
}

export async function deleteCardAction(cardId: string): Promise<ActionState> {
  const res = await run(async () => {
    const user = await requireUser();
    await cards.deleteCard(user.id, cardId);
  });
  if (res.error) return res;
  revalidatePath("/conta/cards");
  redirect("/conta/cards");
}
