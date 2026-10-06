import Link from "next/link";
import { Gavel, Handshake, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardArt } from "./card-art";
import { Countdown } from "./countdown";
import { formatBRL } from "@/lib/money";
import { CONDITION_LABELS, LISTING_TYPE_LABELS } from "@/lib/labels";
import type { ListingCardData } from "@/server/modules/listings";

/** Card em formato de produto no marketplace */
export function ListingCard({ l, priority }: { l: ListingCardData; priority?: boolean }) {
  const isAuction = l.type === "AUCTION" && l.auction;
  const href = isAuction ? `/leiloes/${l.auction!.id}` : `/cards/${l.card.id}`;
  const scheduled = isAuction && new Date(l.auction!.startsAt) > new Date();
  const priceLabel = isAuction ? (l.auction!.currentBidCents ? "Lance atual" : "Lance inicial") : l.type === "NEGOTIATION" ? "Preço de referência" : "Preço";
  const Icon = isAuction ? Gavel : l.type === "NEGOTIATION" ? Handshake : Tag;

  return (
    <Link href={href} className="group surface flex flex-col p-2.5 transition duration-300 hover:-translate-y-0.5 hover:border-gold-400/25 hover:shadow-glow">
      <div className="relative">
        <CardArt src={l.card.images[0]?.url} name={l.card.name} code={l.card.code} color={l.card.category.color} category={l.card.category.name} priority={priority} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge tone={isAuction ? "violet" : l.type === "NEGOTIATION" ? "cyan" : "gold"} className="bg-ink-950/85 backdrop-blur">
            <Icon className="h-3 w-3" /> {LISTING_TYPE_LABELS[l.type]}
          </Badge>
        </div>
        {isAuction && (
          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-lg bg-ink-950/85 px-2.5 py-1.5 text-[11px] backdrop-blur">
            {scheduled ? (
              <span className="text-holo-cyan"><span className="hidden sm:inline">Começa em </span><Countdown to={l.auction!.startsAt} className="text-holo-cyan" /></span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-mist-400">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-bad" /> <span className="hidden sm:inline">termina em</span>
                </span>
                <Countdown to={l.auction!.endsAt} />
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <div className="flex items-center gap-2 text-[11px] text-mist-500">
          <span className="truncate">{l.card.category.name}</span>
          <span aria-hidden>•</span>
          <span className="shrink-0">{CONDITION_LABELS[l.card.condition]}</span>
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-mist-100 group-hover:text-gold-200">{l.card.name}</h3>
        {l.card.setName && <p className="mt-0.5 truncate text-xs text-mist-500">{l.card.setName}{l.card.code ? ` · ${l.card.code}` : ""}</p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5 pt-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-mist-500">{priceLabel}</p>
            <p className="font-display text-lg font-semibold leading-tight text-gold-300 num">{formatBRL(l.currentPriceCents)}</p>
          </div>
          {isAuction ? (
            <span className="shrink-0 text-[11px] text-mist-400 num">{l.auction!.bidCount} lance{l.auction!.bidCount === 1 ? "" : "s"}</span>
          ) : (
            l.quantity > 1 && <span className="shrink-0 text-[11px] text-mist-400">lote × {l.quantity}</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-[11px]">
          <span className="truncate text-mist-500">
            por <span className="text-mist-300">@{l.seller.username}</span>
          </span>
          <span className="shrink-0 font-semibold text-gold-300 transition group-hover:translate-x-0.5">Detalhes →</span>
        </div>
      </div>
    </Link>
  );
}

export function ListingGrid({ items }: { items: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((l, i) => (
        <ListingCard key={l.id} l={l} priority={i < 5} />
      ))}
    </div>
  );
}
