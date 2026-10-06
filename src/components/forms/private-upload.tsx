"use client";

import { useRef, useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/image-compress";

/**
 * Upload para a área privada (documentos de verificação / comprovantes).
 * Guarda a URL retornada em um input hidden. O arquivo só é visível ao dono e à administração.
 */
export function PrivateUpload({ name, folder, label, hint, accept = "image/jpeg,image/png,image/webp", initial }: { name: string; folder: "kyc" | "receipts"; label: string; hint?: string; accept?: string; initial?: string }) {
  const [url, setUrl] = useState(initial ?? "");
  const [file, setFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", await prepareImage(f));
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Falha no envio.");
      setUrl(json.url);
      setFile(f.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  const isImage = url && !url.endsWith(".pdf");
  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition",
          url ? "border-ok/40 bg-ok/5" : "border-white/15 bg-ink-950/40 hover:border-gold-400/50",
        )}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-lg", url ? "bg-ok/15 text-ok" : "bg-white/5 text-mist-400")}>
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : url ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-mist-100">{label}</span>
          <span className={cn("block truncate text-xs", error ? "text-bad" : "text-mist-500")}>
            {error ?? (url ? file ?? "Arquivo enviado — toque para trocar" : busy ? "Enviando…" : hint ?? "Toque para enviar ou tirar uma foto")}
          </span>
        </span>
      </button>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}
