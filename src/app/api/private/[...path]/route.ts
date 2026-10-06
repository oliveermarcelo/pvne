import { getCurrentUser } from "@/server/auth/guards";
import { readPrivateFile } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Documentos e comprovantes: somente o dono do arquivo ou administradores. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { path } = await params;
  const file = await readPrivateFile(path, user);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
