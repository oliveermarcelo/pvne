"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/market";
import { cn } from "@/lib/utils";

export function FavoriteButton({ cardId, initial, loggedIn, count, className }: { cardId: string; initial: boolean; loggedIn: boolean; count?: number; className?: string }) {
  const [fav, setFav] = useOptimistic(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!loggedIn) return router.push(`/entrar?next=${encodeURIComponent(location.pathname)}`);
        start(async () => {
          setFav(!fav);
          await toggleFavoriteAction(cardId);
          router.refresh();
        });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        fav ? "border-holo-rose/40 bg-holo-rose/10 text-holo-rose" : "border-white/10 bg-ink-950/70 text-mist-300 hover:text-holo-rose",
        className,
      )}
    >
      <Heart className={cn("h-3.5 w-3.5", fav && "fill-current")} />
      {count !== undefined ? <span className="num">{count}</span> : fav ? "Favoritado" : "Favoritar"}
    </button>
  );
}
