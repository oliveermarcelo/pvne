import webpush from "web-push";
import { db } from "./db";

/**
 * Notificações push (Web Push / PWA).
 *
 * Fluxo: notify() grava o aviso na mesma transação do evento (lance, proposta, pedido…).
 * Depois do commit, dispatchPendingPush() "reserva" os avisos ainda não enviados com
 * FOR UPDATE SKIP LOCKED — então app e worker podem rodar juntos sem enviar em dobro —
 * e entrega em cada aparelho inscrito do usuário. Se a transação do evento falhar,
 * o aviso não existe e nada é enviado.
 *
 * Chaves VAPID: use VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no .env (gere com `npx web-push generate-vapid-keys`).
 * Sem elas, o sistema gera um par na primeira vez e guarda no banco, para funcionar sem configuração.
 */

type Vapid = { publicKey: string; privateKey: string; subject: string };
const VAPID_SETTING = "_vapid_keys"; // fora de SETTING_DEFAULTS: nunca vai para páginas nem para o admin
const BATCH = 100;
const MAX_AGE_MS = 6 * 3_600_000; // avisos mais velhos que isso não viram push (ex.: servidor ficou fora do ar)

let vapidPromise: Promise<Vapid> | null = null;

function subject() {
  const s = process.env.VAPID_SUBJECT?.trim();
  if (s) return s;
  const app = process.env.APP_URL ?? "";
  return app.startsWith("https://") ? app : "mailto:contato@pvnecards.com.br";
}

async function loadVapid(): Promise<Vapid> {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (pub && priv) return { publicKey: pub, privateKey: priv, subject: subject() };

  const read = async () => {
    const row = await db.setting.findUnique({ where: { key: VAPID_SETTING } });
    return row ? (JSON.parse(row.value) as { publicKey: string; privateKey: string }) : null;
  };
  let keys = await read();
  if (!keys) {
    const fresh = webpush.generateVAPIDKeys();
    // skipDuplicates: se duas instâncias gerarem ao mesmo tempo, vale a primeira gravada
    await db.setting.createMany({ data: [{ key: VAPID_SETTING, value: JSON.stringify(fresh) }], skipDuplicates: true });
    keys = (await read())!;
  }
  return { ...keys, subject: subject() };
}

export function getVapid(): Promise<Vapid> {
  vapidPromise ??= loadVapid().catch((e) => {
    vapidPromise = null;
    throw e;
  });
  return vapidPromise;
}

/** Só aceitamos endereços dos serviços de push dos navegadores (evita o servidor ser usado para chamar URLs arbitrárias). */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
  ".push.samsungosp.com",
];
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.port) return false;
    return PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h));
  } catch {
    return false;
  }
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body?: string; url?: string; tag?: string; ts?: number; unread?: number };

/** Envia para um aparelho. Retorna "gone" quando a inscrição não existe mais. */
async function sendTo(sub: Sub, payload: PushPayload, vapid: Vapid, urgency: "normal" | "high" = "normal"): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      vapidDetails: vapid,
      TTL: 24 * 3600,
      urgency,
      timeout: 10_000,
    });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return "gone";
    console.warn("[push] falha ao enviar:", code ?? (e as Error).message);
    return "error";
  }
}

async function deliver(jobs: { sub: Sub; payload: PushPayload; urgency: "normal" | "high" }[], vapid: Vapid) {
  const ok = new Set<string>();
  const gone = new Set<string>();
  const failed = new Set<string>();
  for (let i = 0; i < jobs.length; i += 10) {
    const chunk = jobs.slice(i, i + 10);
    const res = await Promise.all(chunk.map((j) => sendTo(j.sub, j.payload, vapid, j.urgency)));
    res.forEach((r, k) => (r === "ok" ? ok : r === "gone" ? gone : failed).add(chunk[k]!.sub.id));
  }
  if (gone.size) await db.pushSubscription.deleteMany({ where: { id: { in: [...gone] } } });
  if (ok.size) await db.pushSubscription.updateMany({ where: { id: { in: [...ok] } }, data: { lastSuccessAt: new Date(), failures: 0 } });
  const onlyFailed = [...failed].filter((id) => !ok.has(id));
  if (onlyFailed.length) {
    await db.pushSubscription.updateMany({ where: { id: { in: onlyFailed } }, data: { failures: { increment: 1 } } });
    await db.pushSubscription.deleteMany({ where: { id: { in: onlyFailed }, failures: { gte: 15 } } });
  }
  return ok.size;
}

const HIGH_URGENCY = new Set(["OUTBID", "AUCTION_WON", "AUCTION_ENDING_SOON", "OFFER_RECEIVED", "COUNTER_OFFER", "OFFER_ACCEPTED", "ITEM_SOLD", "ORDER_UPDATE"]);

/** Reserva e envia os avisos pendentes. Seguro para rodar em paralelo (app + worker). */
export async function dispatchPendingPush(): Promise<number> {
  const rows = await db.$queryRaw<{ id: string; user_id: string; type: string; title: string; body: string | null; link: string | null; created_at: Date }[]>`
    UPDATE "notifications" AS n SET "pushed_at" = (now() AT TIME ZONE 'utc')
    WHERE n."id" IN (
      SELECT "id" FROM "notifications" WHERE "pushed_at" IS NULL ORDER BY "created_at" LIMIT ${BATCH} FOR UPDATE SKIP LOCKED
    )
    RETURNING n."id", n."user_id", n."type"::text AS "type", n."title", n."body", n."link", n."created_at"`;
  if (rows.length === 0) return 0;

  const fresh = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < MAX_AGE_MS);
  const userIds = [...new Set(fresh.map((r) => r.user_id))];
  if (userIds.length) {
    const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true } });
    if (subs.length) {
      const unread = await db.notification.groupBy({ by: ["userId"], where: { userId: { in: userIds }, readAt: null }, _count: true });
      const unreadOf = new Map(unread.map((u) => [u.userId, u._count]));
      const jobs = fresh.flatMap((r) =>
        subs
          .filter((s) => s.userId === r.user_id)
          .map((sub) => ({
            sub,
            urgency: (HIGH_URGENCY.has(r.type) ? "high" : "normal") as "normal" | "high",
            payload: {
              title: r.title,
              body: r.body ?? undefined,
              url: r.link ?? "/conta/notificacoes",
              // Avisos repetidos do mesmo assunto (ex.: vários lances no mesmo leilão) se substituem
              tag: r.link ? `${r.type}:${r.link}` : r.id,
              ts: new Date(r.created_at).getTime(),
              unread: unreadOf.get(r.user_id) ?? 0,
            },
          })),
      );
      if (jobs.length) await deliver(jobs, await getVapid());
    }
  }
  // Lote cheio: provavelmente há mais na fila
  if (rows.length === BATCH) return rows.length + (await dispatchPendingPush());
  return rows.length;
}

const timers = new Map<number, ReturnType<typeof setTimeout>>();
/**
 * Agenda o envio logo após o commit da transação que criou o aviso.
 * Duas passadas (rápida e de segurança); o worker também varre a fila a cada ciclo.
 */
export function schedulePushDispatch() {
  if (process.env.PUSH_DISABLED === "1") return;
  for (const delay of [1_200, 8_000]) {
    if (timers.has(delay)) continue;
    const t = setTimeout(() => {
      timers.delete(delay);
      dispatchPendingPush().catch((e) => console.warn("[push] fila:", (e as Error).message));
    }, delay);
    t.unref?.();
    timers.set(delay, t);
  }
}

/** Envio direto para os aparelhos de um usuário (ex.: botão "enviar teste") */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subs = await db.pushSubscription.findMany({ where: { userId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  if (!subs.length) return 0;
  return deliver(subs.map((sub) => ({ sub, payload, urgency: "high" as const })), await getVapid());
}
