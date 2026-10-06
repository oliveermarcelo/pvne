import { NextResponse } from "next/server";
import { getVapid } from "@/server/push";

export const dynamic = "force-dynamic";

/** Chave pública VAPID que o navegador usa para se inscrever no push */
export async function GET() {
  const { publicKey } = await getVapid();
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
