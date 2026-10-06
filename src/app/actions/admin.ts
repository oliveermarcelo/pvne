"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/guards";
import { getRequestMeta } from "@/server/request";
import { formToObject } from "@/server/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { DomainError, type ActionState } from "@/server/errors";
import { SETTING_KEYS } from "@/server/settings";
import { getSession } from "@/server/auth/session";
import { isUploadUrl } from "@/server/storage";
import * as users from "@/server/modules/users";
import * as categories from "@/server/modules/categories";
import * as cards from "@/server/modules/cards";
import * as listings from "@/server/modules/listings";
import * as auctions from "@/server/modules/auctions";
import * as negotiations from "@/server/modules/negotiations";
import * as contacts from "@/server/modules/contacts";
import * as pages from "@/server/modules/pages";
import { run } from "./_run";

async function ctx() {
  const admin = await requireAdmin();
  const { ip } = await getRequestMeta();
  return { admin, ip };
}

// ─── Usuários ─────────────────────────────────────────────────

export async function adminCreateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await run(async () => {
    const { admin, ip } = await ctx();
    id = (await users.adminCreateUser(admin.id, formToObject(fd), ip)).id;
  });
  if (res.error) return res;
  revalidatePath("/admin/usuarios", "layout");
  redirect(`/admin/usuarios/${id}?criado=1`);
}

export async function adminUpdateUserAction(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await users.adminUpdateUser(admin.id, userId, formToObject(fd), ip);
    // Nome/foto aparecem no cabeçalho e no painel: atualiza o layout inteiro
    revalidatePath("/", "layout");
    return { ok: true, message: "Dados salvos." };
  });
}

export async function adminSetPasswordAction(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    const session = await getSession();
    await users.adminSetPassword(admin.id, userId, formToObject(fd), session?.sessionId ?? "", ip);
    revalidatePath(`/admin/usuarios/${userId}`);
    return { ok: true, message: admin.id === userId ? "Sua senha foi alterada." : "Senha alterada. Informe a nova senha ao usuário por um canal seguro." };
  });
}

export async function adminSetUserStatusAction(userId: string, status: "ACTIVE" | "BLOCKED"): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await users.adminSetUserStatus(admin.id, userId, status, ip);
    revalidatePath("/admin/usuarios", "layout");
    return { ok: true, message: status === "BLOCKED" ? "Usuário bloqueado." : "Usuário desbloqueado." };
  });
}

export async function adminDeleteUserAction(userId: string): Promise<ActionState> {
  const res = await run(async () => {
    const { admin, ip } = await ctx();
    await users.adminDeleteUser(admin.id, userId, ip);
  });
  if (res.error) return res;
  revalidatePath("/admin/usuarios", "layout");
  redirect("/admin/usuarios?excluido=1");
}

// ─── Categorias ───────────────────────────────────────────────

export async function adminSaveCategoryAction(categoryId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const res = await run(async () => {
    const { admin, ip } = await ctx();
    await categories.saveCategory(admin.id, categoryId, formToObject(fd), ip);
  });
  if (res.error) return res;
  revalidatePath("/", "layout");
  redirect("/admin/categorias");
}

export async function adminToggleCategoryAction(categoryId: string): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await categories.toggleCategory(admin.id, categoryId, ip);
    revalidatePath("/", "layout");
  });
}

export async function adminDeleteCategoryAction(categoryId: string): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await categories.deleteCategory(admin.id, categoryId, ip);
    revalidatePath("/", "layout");
    return { ok: true, message: "Categoria excluída." };
  });
}

// ─── Cards / anúncios ─────────────────────────────────────────

export async function adminSetCardStatusAction(cardId: string, status: "ACTIVE" | "BLOCKED" | "REMOVED", _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 300) || null;
    await cards.adminSetCardStatus(admin.id, cardId, status, reason, ip);
    revalidatePath("/", "layout");
    return { ok: true, message: "Status do card atualizado." };
  });
}

export async function adminUpdateCardAction(cardId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await cards.adminUpdateCard(admin.id, cardId, formToObject(fd), ip);
    revalidatePath("/", "layout");
    return { ok: true, message: "Card atualizado." };
  });
}

export async function adminCancelListingAction(listingId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin } = await ctx();
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 300) || "Cancelado pela administração.";
    const block = fd.get("block") === "on";
    await listings.cancelListing({ id: admin.id, role: "ADMIN" }, listingId, reason, block ? "BLOCKED" : "CANCELLED");
    revalidatePath("/", "layout");
    return { ok: true, message: block ? "Anúncio bloqueado." : "Anúncio cancelado." };
  });
}

// ─── Leilões ──────────────────────────────────────────────────

export async function adminCreateAuctionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let auctionId = "";
  const res = await run(async () => {
    const { admin, ip } = await ctx();
    const input = formToObject(fd);
    const cardId = String(input.cardId ?? "").trim();
    if (!cardId) throw new DomainError("Informe o ID do card.", "VALIDATION", { cardId: "Obrigatório." });
    const l = await listings.createListing({ id: admin.id, role: "ADMIN" }, cardId, { ...input, type: "AUCTION" }, ip);
    auctionId = l.auctionId ?? "";
  });
  if (res.error) return res;
  revalidatePath("/", "layout");
  redirect(`/admin/leiloes/${auctionId}`);
}

export async function adminUpdateAuctionAction(auctionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await auctions.adminUpdateAuction(admin.id, auctionId, formToObject(fd), ip);
    revalidatePath("/", "layout");
    return { ok: true, message: "Leilão atualizado." };
  });
}

export async function adminCloseAuctionAction(auctionId: string): Promise<ActionState> {
  return run(async () => {
    const { admin } = await ctx();
    const r = await auctions.closeAuction(auctionId, { force: true, actorId: admin.id });
    revalidatePath("/", "layout");
    return { ok: true, message: r.closed ? "Leilão encerrado." : "O leilão já estava encerrado." };
  });
}

export async function adminCancelAuctionAction(auctionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin } = await ctx();
    const a = await db.auction.findUniqueOrThrow({ where: { id: auctionId }, select: { listingId: true } });
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 300) || "Cancelado pela administração.";
    await listings.cancelListing({ id: admin.id, role: "ADMIN" }, a.listingId, reason);
    revalidatePath("/", "layout");
    return { ok: true, message: "Leilão cancelado e participantes notificados." };
  });
}

// ─── Negociações ──────────────────────────────────────────────

export async function adminInterveneAction(negotiationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await negotiations.adminIntervene(admin.id, negotiationId, formToObject(fd), ip);
    revalidatePath(`/admin/negociacoes/${negotiationId}`);
    return { ok: true, message: "Intervenção registrada." };
  });
}

// ─── Contatos ─────────────────────────────────────────────────

export async function adminUpdateContactAction(contactId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    await contacts.adminUpdateContact(admin.id, contactId, formToObject(fd), ip);
    revalidatePath("/admin/contatos", "layout");
    return { ok: true, message: "Solicitação atualizada." };
  });
}

// ─── Conteúdo e configurações ─────────────────────────────────

export async function adminSavePageAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    if (!pages.isPageSlug(slug)) throw new DomainError("Página inválida.");
    await pages.savePage(admin.id, slug, formToObject(fd), ip);
    revalidatePath("/", "layout");
    return { ok: true, message: "Página salva." };
  });
}

export async function adminSaveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { admin, ip } = await ctx();
    const input = formToObject(fd);
    // Upload opcional: ausente no formulário = imagem removida
    if (fd.get("_has_hero_watermark") === "1" && !("hero_watermark_url" in input)) input.hero_watermark_url = "";
    const changed: string[] = [];
    for (const key of SETTING_KEYS) {
      if (!(key in input)) continue;
      const value = String(input[key] ?? "").trim().slice(0, 500);
      if (key === "hero_watermark_url") {
        if (value && !isUploadUrl(value)) throw new DomainError("Imagem inválida.", "VALIDATION", { [key]: "Envie a imagem pelo formulário." });
      } else if (key.endsWith("_url") && value && !/^https:\/\//.test(value)) {
        throw new DomainError("Links devem começar com https://", "VALIDATION", { [key]: "Use um link https://" });
      }
      if ((key.startsWith("auction_") || key.endsWith("_hours") || key.endsWith("_days")) && !/^\d{1,4}$/.test(value)) {
        throw new DomainError("Prazos devem ser números inteiros.", "VALIDATION", { [key]: "Número inteiro." });
      }
      if (key === "commission_percent" && !(/^\d{1,2}([.,]\d{1,2})?$/.test(value) && parseFloat(value.replace(",", ".")) <= 50)) {
        throw new DomainError("Comissão inválida (0 a 50%).", "VALIDATION", { [key]: "Ex.: 10 ou 8,5" });
      }
      await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      changed.push(key);
    }
    await audit(db, { actorId: admin.id, action: "admin.settings_updated", data: { keys: changed }, ip });
    revalidatePath("/", "layout");
    return { ok: true, message: "Configurações salvas." };
  });
}
