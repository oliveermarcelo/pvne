"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/server/auth/guards";
import { getRequestMeta } from "@/server/request";
import { formToObject } from "@/server/validation";
import type { ActionState } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import * as orders from "@/server/modules/orders";
import { run } from "./_run";

const refresh = (id: string) => {
  revalidatePath(`/conta/pedidos/${id}`);
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/conta/pedidos");
};

// Comprador
export async function saveAddressAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    await orders.saveShippingAddress(user.id, orderId, formToObject(fd));
    refresh(orderId);
    return { ok: true, message: "Endereço salvo." };
  });
}

export async function reportPaymentAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    await orders.reportPayment(user.id, orderId, fd.get("receipt"), ip);
    refresh(orderId);
    return { ok: true, message: "Comprovante enviado! A PVNE vai conferir o pagamento." };
  });
}

export async function confirmDeliveryAction(orderId: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    await orders.confirmDelivery(user.id, orderId, ip);
    refresh(orderId);
    return { ok: true, message: "Recebimento confirmado. O card já está na sua coleção!" };
  });
}

export async function openDisputeAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    await orders.openDispute(user.id, orderId, fd.get("reason"), ip);
    refresh(orderId);
    return { ok: true, message: "Problema registrado. A equipe PVNE vai analisar e responder no pedido." };
  });
}

// Vendedor
export async function markShippedAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    await orders.markShipped(user.id, orderId, formToObject(fd), ip);
    refresh(orderId);
    return { ok: true, message: "Envio registrado. O comprador foi avisado." };
  });
}

// Chat (partes e admin)
export async function orderMessageAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`ordermsg:${user.id}`, 60, 60 * 60_000);
    const r = await orders.postOrderMessage(user, orderId, fd.get("body"));
    refresh(orderId);
    return { ok: true, message: r.masked ? "Mensagem enviada. Dados de contato foram removidos: toda a negociação acontece pela PVNE." : undefined };
  });
}

// Administração
async function admin() {
  const a = await requireAdmin();
  const { ip } = await getRequestMeta();
  return { a, ip };
}

export async function adminConfirmPaymentAction(orderId: string): Promise<ActionState> {
  return run(async () => {
    const { a, ip } = await admin();
    await orders.adminConfirmPayment(a.id, orderId, ip);
    refresh(orderId);
    return { ok: true, message: "Pagamento confirmado. Vendedor avisado para enviar." };
  });
}

export async function adminRejectPaymentAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { a, ip } = await admin();
    await orders.adminRejectPayment(a.id, orderId, fd.get("reason"), ip);
    refresh(orderId);
    return { ok: true, message: "Comprovante recusado. O comprador foi avisado." };
  });
}

export async function adminCancelOrderAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { a, ip } = await admin();
    await orders.adminCancelOrder(a.id, orderId, formToObject(fd), ip);
    refresh(orderId);
    return { ok: true, message: "Pedido cancelado." };
  });
}

export async function adminResolveDisputeAction(orderId: string, resolution: "release" | "resume", _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { a, ip } = await admin();
    await orders.adminResolveDispute(a.id, orderId, resolution, fd.get("note"), ip);
    refresh(orderId);
    return { ok: true, message: resolution === "release" ? "Pedido liberado ao vendedor." : "Pedido retomado." };
  });
}

export async function adminPayoutAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { a, ip } = await admin();
    await orders.adminRegisterPayout(a.id, orderId, fd.get("reference"), ip);
    refresh(orderId);
    revalidatePath("/admin/repasses");
    return { ok: true, message: "Repasse registrado. Pedido concluído." };
  });
}
