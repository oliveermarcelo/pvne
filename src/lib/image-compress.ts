/**
 * Prepara fotos tiradas no celular antes do envio: corrige a rotação (EXIF),
 * reduz para no máximo 2400 px e recomprime. Uma foto de 8–12 MB vira ~400–900 KB,
 * o envio fica rápido no 4G e cabe no limite do servidor.
 * Se o navegador não conseguir ler a imagem, envia o arquivo original.
 */
const MAX_SIDE = 2400;
const SKIP_BELOW = 900 * 1024;

export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || typeof createImageBitmap === "undefined") return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const isHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (scale === 1 && file.size <= SKIP_BELOW && !isHeic) return file;
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    // PNG pode ter transparência: vira WEBP (mantém o fundo transparente); o resto vira JPEG
    const type = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, type === "image/webp" ? 0.9 : 0.86));
    if (!blob || (blob.size >= file.size && !isHeic)) return file;
    const ext = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type, lastModified: Date.now() });
  } finally {
    bmp.close();
  }
}
