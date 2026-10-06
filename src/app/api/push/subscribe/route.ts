import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth/session";
import { isAllowedPushEndpoint } from "@/server/push";
import { rateLimit } from "@/server/rate-limit";
import { DomainError } from "@/server/errors";

export const dynamic = "force-dynamic";

const MAX_DEVICES = 15;
const b64url = z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+=*$/);
const schema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: b64url, auth: b64url }),
  }),
  replaces: z.string().max(1000).optional(),
});

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin || origin === process.env.APP_URL?.replace(/\/$/, "");
}

/** Liga o push neste aparelho (ou reassocia a inscrição à sessão atual) */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem inválida" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Entre na sua conta para ativar as notificações." }, { status: 401 });
  try {
    rateLimit(`push-sub:${session.user.id}`, 30, 10 * 60_000);
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  const { subscription: s, replaces } = parsed.data;
  if (!isAllowedPushEndpoint(s.endpoint)) return NextResponse.json({ error: "Serviço de push não suportado." }, { status: 400 });

  const userId = session.user.id;
  const data = { userId, sessionId: session.sessionId, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null, failures: 0 };
  await db.$transaction(async (tx) => {
    if (replaces && replaces !== s.endpoint) await tx.pushSubscription.deleteMany({ where: { endpoint: replaces, userId } });
    // Mesmo aparelho trocando de conta: a inscrição passa a ser do usuário logado agora
    await tx.pushSubscription.upsert({ where: { endpoint: s.endpoint }, create: { endpoint: s.endpoint, ...data }, update: data });
    const extra = await tx.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: MAX_DEVICES, select: { id: true } });
    if (extra.length) await tx.pushSubscription.deleteMany({ where: { id: { in: extra.map((x) => x.id) } } });
  });
  const devices = await db.pushSubscription.count({ where: { userId } });
  return NextResponse.json({ ok: true, devices });
}

/** Desliga o push neste aparelho */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem inválida" }, { status: 403 });
  const session = await getSession();
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!session || !body?.endpoint) return NextResponse.json({ ok: true });
  await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
