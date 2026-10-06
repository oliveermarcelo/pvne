import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processAuctions } from "@/server/modules/auctions";
import { processOrders } from "@/server/modules/orders";
import { dispatchPendingPush } from "@/server/push";

export const dynamic = "force-dynamic";

/**
 * Alternativa ao worker: um agendador externo (cron da VPS, n8n, etc.)
 * pode chamar  POST /api/cron/auctions  com  Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const auctions = await processAuctions();
  const orders = await processOrders();
  const push = await dispatchPendingPush().catch(() => 0);
  return NextResponse.json({ ok: true, auctions, orders, push });
}
