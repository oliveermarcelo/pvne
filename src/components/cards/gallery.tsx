"use client";

import { useState } from "react";
import { CardArt } from "./card-art";
import { cn } from "@/lib/utils";

export function CardGallery({ images, name, code, color, category }: { images: { url: string }[]; name: string; code?: string | null; color?: string | null; category?: string }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="group rounded-3xl border border-white/[0.06] bg-gradient-to-b from-ink-800 to-ink-900 p-4 sm:p-6">
        <div className="mx-auto max-w-[380px] drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]">
          <CardArt src={images[i]?.url} name={name} code={code} color={color} category={category} rounded="rounded-2xl" priority />
        </div>
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Imagem ${idx + 1}`}
              className={cn("w-16 shrink-0 overflow-hidden rounded-lg border-2 transition", idx === i ? "border-gold-400" : "border-transparent opacity-60 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-card w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
