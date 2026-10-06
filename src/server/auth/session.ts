import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "../db";
import { randomToken, sha256 } from "./tokens";

export const SESSION_COOKIE = "pvne_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED" | "DELETED";
};

export async function createSession(userId: string, meta: { ip: string | null; userAgent: string | null }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
    path: "/",
    expires: expiresAt,
  });
}

/** Sessão atual (memoizada por requisição). Retorna null se ausente, expirada ou usuário inativo. */
export const getSession = cache(async (): Promise<{ user: SessionUser; sessionId: string } | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const session = await db.session.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, email: true, avatarUrl: true, role: true, status: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  return { user: session.user, sessionId: id };
});

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
