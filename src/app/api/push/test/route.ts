import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { sendPushToUser } from "@/server/push";
import { rateLimit } from "@/server/rate-limit";
import { DomainError } from "@/server/errors";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** Envia uma notificação de teste para todos os aparelhos do usuário logado */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin && origin !== process.env.APP_URL?.replace(/\/$/, "")) {
    return NextResponse.json({ error: "origem inválida" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    rateLimit(`push-test:${session.user.id}`, 5, 10 * 60_000);
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const s = await getSettings();
  const sent = await sendPushToUser(session.user.id, {
    title: `${s.site_name}: notificações ativadas`,
    body: "É assim que você vai saber de lances, propostas e pedidos — mesmo com o app fechado.",
    url: "/conta/notificacoes",
    tag: "push-test",
  });
  return NextResponse.json({ ok: true, sent });
}
