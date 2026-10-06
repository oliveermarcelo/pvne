import { redirect } from "next/navigation";
import { ForbiddenError } from "../errors";
import { getSession, type SessionUser } from "./session";

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** Para páginas: redireciona ao login se não autenticado */
export async function requireUserPage(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Para páginas administrativas */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUserPage("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Para actions/APIs: lança erro em vez de redirecionar */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Faça login para continuar.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError("Acesso restrito à administração.");
  return user;
}
