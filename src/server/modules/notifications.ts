import type { DbOrTx } from "../db";
import { db } from "../db";
import { schedulePushDispatch } from "../push";
import type { NotificationType } from "@/generated/prisma/enums";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, string | number | boolean | null>;
};

/**
 * Cria notificações dentro da mesma transação do evento que as gerou —
 * se o evento falhar, a notificação também não existe.
 * Ponto único para plugar canais de entrega: o push no celular sai depois do commit
 * (ver src/server/push.ts); e-mail/WhatsApp podem ser plugados aqui no futuro.
 */
export async function notify(client: DbOrTx, input: NotifyInput | NotifyInput[]) {
  const list = (Array.isArray(input) ? input : [input]).filter((n) => !!n.userId);
  if (list.length === 0) return;
  await client.notification.createMany({
    data: list.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      data: n.data ?? undefined,
    })),
  });
  schedulePushDispatch();
}

/** Notifica todos os administradores ativos */
export async function notifyAdmins(client: DbOrTx, input: Omit<NotifyInput, "userId">) {
  const admins = await client.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  await notify(client, admins.map((a) => ({ ...input, userId: a.id })));
}

export function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export function listNotifications(userId: string, take = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function markRead(userId: string, id?: string) {
  await db.notification.updateMany({
    where: { userId, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
}
