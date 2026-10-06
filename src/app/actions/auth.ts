"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroyCurrentSession, getSession } from "@/server/auth/session";
import { requireUser } from "@/server/auth/guards";
import { getRequestMeta } from "@/server/request";
import { formToObject } from "@/server/validation";
import type { ActionState } from "@/server/errors";
import * as users from "@/server/modules/users";
import { run, safeNext } from "./_run";

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const meta = await getRequestMeta();
  const res = await run(async () => {
    const user = await users.registerUser(formToObject(fd), meta);
    await createSession(user.id, meta);
  });
  if (res.error) return res;
  redirect(safeNext(fd.get("next"), "/conta?bemvindo=1"));
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const meta = await getRequestMeta();
  let role = "USER";
  const res = await run(async () => {
    const user = await users.authenticate(String(fd.get("identifier") ?? ""), String(fd.get("password") ?? ""), meta);
    role = user.role;
    await createSession(user.id, meta);
  });
  if (res.error) return res;
  redirect(safeNext(fd.get("next"), role === "ADMIN" ? "/admin" : "/conta"));
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const meta = await getRequestMeta();
  return run(async () => {
    await users.requestPasswordReset(String(fd.get("email") ?? ""), meta);
    return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em instantes." };
  });
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const meta = await getRequestMeta();
  const res = await run(async () => users.resetPassword(formToObject(fd), meta));
  if (res.error) return res;
  redirect("/entrar?senha=redefinida");
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const meta = await getRequestMeta();
  return run(async () => {
    const session = await getSession();
    if (!session) throw new Error("sem sessão");
    await users.changePassword(session.user.id, formToObject(fd), session.sessionId, meta);
    return { ok: true, message: "Senha alterada. As outras sessões foram encerradas." };
  });
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const updated = await users.updateProfile(user.id, formToObject(fd));
    revalidatePath("/", "layout");
    return { ok: true, message: "Perfil atualizado.", data: updated.username };
  });
}
