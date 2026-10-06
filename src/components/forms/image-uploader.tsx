"use client";

import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/image-compress";

/**
 * Envia imagens para /api/upload e guarda as URLs em inputs hidden (name repetido).
 * A primeira imagem é a capa.
 */
export function ImageUploader({
  name,
  initial = [],
  max = 6,
  folder = "cards",
  aspect = "card",
}: {
  name: string;
  initial?: string[];
  max?: number;
  folder?: "cards" | "avatars" | "albums" | "categories" | "site";
  aspect?: "card" | "square" | "wide";
}) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    try {
      const room = max - urls.length;
      for (const file of Array.from(files).slice(0, room)) {
        const fd = new FormData();
        fd.append("file", await prepareImage(file));
        fd.append("folder", folder);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error ?? "Falha no envio.");
        setUrls((u) => [...u, json.url!]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const ratio = aspect === "card" ? "aspect-card" : aspect === "square" ? "aspect-square" : "aspect-[16/9]";
  const single = max === 1;

  return (
    <div>
      <div className={cn("grid gap-3", single ? "max-w-[180px] grid-cols-1" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6")}>
        {urls.map((u, i) => (
          <div key={u} className={cn("group relative overflow-hidden rounded-xl border border-white/10 bg-ink-950", ratio)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
            <input type="hidden" name={name} value={u} />
            {!single && i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-ink-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-gold-300">Capa</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-ink-950/90 p-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              {!single && i > 0 && (
                <button type="button" title="Definir como capa" onClick={() => setUrls((x) => [u, ...x.filter((y) => y !== u)])} className="rounded-md bg-ink-800 p-2 text-gold-300 hover:bg-ink-700">
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" title="Remover" onClick={() => setUrls((x) => x.filter((y) => y !== u))} className="rounded-md bg-ink-800 p-2 text-bad hover:bg-ink-700">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {urls.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-ink-950/40 text-xs text-mist-400 transition hover:border-gold-400/50 hover:text-gold-200",
              ratio,
            )}
          >
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <ImagePlus className="h-5 w-5" />}
            {busy ? "Enviando…" : "Adicionar"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple={!single} hidden onChange={(e) => upload(e.target.files)} />
      <p className={cn("mt-2 text-xs", error ? "text-bad" : "text-mist-500")}>
        {error ?? `JPG, PNG, WEBP ou GIF — fotos do celular são reduzidas automaticamente${single ? "" : ` · até ${max} imagens · a primeira é a capa`}.`}
      </p>
    </div>
  );
}
