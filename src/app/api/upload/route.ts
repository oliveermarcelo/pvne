import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { PRIVATE_FOLDERS, saveImage, savePrivateFile, UPLOAD_FOLDERS, type PrivateFolder, type UploadFolder } from "@/server/storage";

export async function POST(req: Request) {
  // Proteção CSRF: só aceita envio a partir do próprio site
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para enviar imagens." }, { status: 401 });

  try {
    rateLimit(`upload:${user.id}`, 60, 10 * 60_000);
    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "cards");
    if (!(file instanceof File)) throw new DomainError("Nenhum arquivo enviado.");
    if (PRIVATE_FOLDERS.includes(folder as PrivateFolder)) {
      const url = await savePrivateFile(file, folder as PrivateFolder, user.id);
      return NextResponse.json({ url, name: file.name });
    }
    if (!UPLOAD_FOLDERS.includes(folder as UploadFolder)) throw new DomainError("Destino inválido.");
    if ((folder === "categories" || folder === "site") && user.role !== "ADMIN") throw new DomainError("Sem permissão.");
    const url = await saveImage(file, folder as UploadFolder);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof DomainError ? e.message : "Falha ao enviar a imagem.";
    if (!(e instanceof DomainError)) console.error("[upload]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
