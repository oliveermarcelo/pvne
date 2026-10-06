import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./auth/tokens";
import { DomainError } from "./errors";

/**
 * Armazenamento de arquivos em disco local.
 * Interface pensada para trocar por S3/R2 no futuro sem mexer no resto do sistema:
 * basta reimplementar saveImage/readUpload mantendo as URLs "/uploads/...".
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_FOLDERS = ["cards", "avatars", "albums", "categories", "site"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf" } as const;
type Ext = keyof typeof MIME;

export const UPLOAD_URL_RE = /^\/uploads\/(cards|avatars|albums|categories|site)\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{10,64}\.(jpg|png|webp|gif)$/;
export const isUploadUrl = (url: string) => UPLOAD_URL_RE.test(url);

export function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
}

/** Detecta o tipo real pelo conteúdo (magic bytes), ignorando nome/extensão enviados */
function detectImage(buf: Buffer): Ext | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  return null;
}

function detectPdf(buf: Buffer): Ext | null {
  return buf.subarray(0, 5).toString("ascii") === "%PDF-" ? "pdf" : null;
}

export async function saveImage(file: File, folder: UploadFolder): Promise<string> {
  if (!UPLOAD_FOLDERS.includes(folder)) throw new DomainError("Destino de upload inválido.");
  if (file.size === 0) throw new DomainError("Arquivo vazio.");
  if (file.size > MAX_UPLOAD_BYTES) throw new DomainError("A imagem deve ter no máximo 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detectImage(buf);
  if (!ext) throw new DomainError("Formato não suportado. Envie JPG, PNG, WEBP ou GIF (foto em HEIC? no celular, ajuste a câmera para \"Mais compatível\").");

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const name = `${randomToken(16)}.${ext}`;
  const dir = path.join(uploadRoot(), folder, yyyy, mm);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${folder}/${yyyy}/${mm}/${name}`;
}

export async function readUpload(segments: string[]): Promise<{ data: Buffer; contentType: string } | null> {
  const url = "/uploads/" + segments.join("/");
  if (!isUploadUrl(url)) return null;
  const full = path.resolve(uploadRoot(), ...segments);
  if (!full.startsWith(uploadRoot() + path.sep)) return null;
  try {
    const data = await readFile(full);
    const ext = path.extname(full).slice(1) as Ext;
    return { data, contentType: MIME[ext] };
  } catch {
    return null;
  }
}

// ─── Arquivos privados ────────────────────────────────────────
// Documentos de verificação (KYC) e comprovantes de pagamento. Nunca ficam em /uploads:
// são servidos por /api/private/..., só para o próprio usuário e a administração.

export const PRIVATE_FOLDERS = ["kyc", "receipts"] as const;
export type PrivateFolder = (typeof PRIVATE_FOLDERS)[number];

export const PRIVATE_URL_RE = /^\/api\/private\/(kyc|receipts)\/([a-z0-9]{10,40})\/[A-Za-z0-9_-]{10,64}\.(jpg|png|webp|pdf)$/;

export function privateRoot() {
  return path.resolve(process.env.PRIVATE_UPLOAD_DIR ?? "./storage/private");
}

/** URL privada pertence ao usuário e à pasta esperada? */
export function isPrivateUrlOf(url: string, folder: PrivateFolder, userId: string) {
  const m = PRIVATE_URL_RE.exec(url);
  return !!m && m[1] === folder && m[2] === userId;
}

export async function savePrivateFile(file: File, folder: PrivateFolder, userId: string): Promise<string> {
  if (!PRIVATE_FOLDERS.includes(folder)) throw new DomainError("Destino de upload inválido.");
  if (file.size === 0) throw new DomainError("Arquivo vazio.");
  if (file.size > 8 * 1024 * 1024) throw new DomainError("O arquivo deve ter no máximo 8 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const img = detectImage(buf);
  const ext = img && img !== "gif" ? img : folder === "receipts" ? detectPdf(buf) : null;
  if (!ext) throw new DomainError(folder === "receipts" ? "Envie o comprovante em JPG, PNG, WEBP ou PDF." : "Envie a imagem em JPG, PNG ou WEBP.");
  const dir = path.join(privateRoot(), folder, userId);
  await mkdir(dir, { recursive: true });
  const name = `${randomToken(18)}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  return `/api/private/${folder}/${userId}/${name}`;
}

/** Lê um arquivo privado se o visitante for o dono ou administrador */
export async function readPrivateFile(segments: string[], viewer: { id: string; role: string }) {
  const url = "/api/private/" + segments.join("/");
  const m = PRIVATE_URL_RE.exec(url);
  if (!m) return null;
  if (viewer.role !== "ADMIN" && viewer.id !== m[2]) return null;
  const full = path.resolve(privateRoot(), ...segments);
  if (!full.startsWith(privateRoot() + path.sep)) return null;
  try {
    const data = await readFile(full);
    return { data, contentType: MIME[m[3] as Ext] };
  } catch {
    return null;
  }
}
