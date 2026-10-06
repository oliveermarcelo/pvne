"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/server/auth/guards";
import { getRequestMeta } from "@/server/request";
import { formToObject } from "@/server/validation";
import type { ActionState } from "@/server/errors";
import * as sellers from "@/server/modules/sellers";
import { run } from "./_run";

export async function sellerApplicationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const { ip } = await getRequestMeta();
    await sellers.submitSellerApplication(user.id, formToObject(fd), ip);
    revalidatePath("/conta", "layout");
    return { ok: true, message: "Pedido enviado! Avisaremos assim que a análise for concluída." };
  });
}

export async function adminReviewSellerAction(applicationId: string, decision: "approve" | "reject", _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const a = await requireAdmin();
    const { ip } = await getRequestMeta();
    await sellers.adminReviewApplication(a.id, applicationId, decision, fd.get("reason"), ip);
    revalidatePath("/admin/vendedores", "layout");
    return { ok: true, message: decision === "approve" ? "Vendedor aprovado." : "Pedido recusado." };
  });
}

export async function adminSellerStatusAction(userId: string, status: "SUSPENDED" | "APPROVED", _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const a = await requireAdmin();
    const { ip } = await getRequestMeta();
    await sellers.adminSetSellerStatus(a.id, userId, status, fd.get("reason"), ip);
    revalidatePath("/admin", "layout");
    return { ok: true, message: status === "SUSPENDED" ? "Vendedor suspenso." : "Vendedor reativado." };
  });
}
