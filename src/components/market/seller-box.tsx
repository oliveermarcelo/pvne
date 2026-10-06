import Link from "next/link";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { formatMonthYear } from "@/lib/dates";

export function SellerBox({ seller, label = "Vendedor" }: { seller: { name: string; username: string; avatarUrl: string | null; city: string | null; state: string | null; createdAt: Date }; label?: string }) {
  return (
    <Link href={`/colecionador/${seller.username}`} className="surface-2 flex items-center gap-3 p-4 transition hover:border-white/15">
      <Avatar name={seller.name} src={seller.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-mist-500">{label}</p>
        <p className="truncate text-sm font-semibold">{seller.name} <span className="font-normal text-mist-500">@{seller.username}</span></p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-mist-500">
          {seller.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{seller.city}{seller.state ? `/${seller.state}` : ""}</span>}
          <span>desde {formatMonthYear(seller.createdAt)}</span>
        </p>
      </div>
      <span className="text-xs font-semibold text-gold-300">Ver coleção →</span>
    </Link>
  );
}
