"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compartilhar pelo menu nativo do celular (WhatsApp, Instagram…); no computador copia o link */
export function ShareButton({ title, text, className }: { title: string; text?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = location.href.split("?")[0]!;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* usuário cancelou */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copie o link:", url);
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/70 px-3 py-1.5 text-xs font-semibold text-mist-300 transition hover:text-gold-200", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Share2 className="h-3.5 w-3.5" />} {copied ? "Link copiado" : "Compartilhar"}
    </button>
  );
}
