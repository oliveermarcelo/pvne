import { NextResponse } from "next/server";
import { getAuctionLiveState } from "@/server/modules/auctions";

export const dynamic = "force-dynamic";

/** Estado do leilão para atualização em tempo real na página (polling curto). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const s = await getAuctionLiveState(id);
    return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Leilão não encontrado." }, { status: 404 });
  }
}
