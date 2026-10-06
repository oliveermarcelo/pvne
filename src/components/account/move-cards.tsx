"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveCardsAction } from "@/app/actions/catalog";
import { CardArt } from "@/components/cards/card-art";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type C = { id: string; name: string; image?: string; color?: string | null; category: string };

/** Seleciona cards e adiciona ao álbum (ou remove, quando albumId = null) */
export function MoveCards({ cards, albumId, label }: { cards: C[]; albumId: string | null; label: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (cards.length === 0) return <p className="text-sm text-mist-500">Nenhum card disponível.</p>;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {cards.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setSel((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
              className={cn("rounded-xl p-1 text-left transition", on ? "bg-gold-400/20 ring-2 ring-gold-400" : "hover:bg-white/5")}
            >
              <CardArt src={c.image} name={c.name} color={c.color} category={c.category} rounded="rounded-lg" />
              <p className="mt-1 truncate px-0.5 text-[11px] text-mist-300">{c.name}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!sel.length || pending}
          onClick={() =>
            start(async () => {
              const r = await moveCardsAction(sel, albumId);
              setMsg(r.error ?? r.message ?? null);
              setSel([]);
              router.refresh();
            })
          }
          className={buttonClass(albumId ? "primary" : "secondary", "sm")}
        >
          {pending ? "Aguarde…" : `${label}${sel.length ? ` (${sel.length})` : ""}`}
        </button>
        {msg && <span className="text-xs text-mist-400">{msg}</span>}
      </div>
    </div>
  );
}
