import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Layers, MapPin, ShoppingBag } from "lucide-react";
import { getPublicProfile } from "@/server/modules/users";
import { searchMarketplace } from "@/server/modules/listings";
import { ListingGrid } from "@/components/cards/listing-card";
import { CardArt } from "@/components/cards/card-art";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { formatMonthYear } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await getPublicProfile((await params).username);
  return { title: u ? `${u.name} (@${u.username})` : "Colecionador" };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const user = await getPublicProfile(username);
  if (!user) notFound();
  const listings = await searchMarketplace({ seller: user.username, perPage: 30 });

  return (
    <div className="container py-10">
      <section className="surface relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-holo-violet/20 via-holo-cyan/10 to-gold-400/20" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          <Avatar name={user.name} src={user.avatarUrl} size={104} className="ring-4 ring-ink-850" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">{user.name}</h1>
            <p className="text-sm text-mist-400">@{user.username}</p>
            {user.bio && <p className="mt-3 max-w-2xl text-sm text-mist-300">{user.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mist-500">
              {user.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{user.city}{user.state ? `/${user.state}` : ""}</span>}
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Colecionador desde {formatMonthYear(user.createdAt)}</span>
            </div>
          </div>
          <div className="flex gap-6 text-center">
            {[
              { v: user._count.cards, l: "cards" },
              { v: user._count.listings, l: "à venda" },
              { v: user._count.ordersSelling, l: "vendas" },
            ].map((s) => (
              <div key={s.l}>
                <p className="font-display text-2xl font-semibold num">{s.v}</p>
                <p className="text-xs text-mist-500">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold"><Layers className="h-5 w-5 text-gold-300" /> Álbuns</h2>
        {user.albums.length === 0 ? (
          <p className="text-sm text-mist-500">Nenhum álbum público.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {user.albums.map((a) => (
              <Link key={a.id} href={`/albuns/${a.id}`} className="group surface flex gap-4 p-4 transition hover:border-white/15">
                <div className="w-20 shrink-0">
                  {a.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.coverUrl} alt="" className="aspect-card w-full rounded-lg object-cover" />
                  ) : (
                    <CardArt name={a.name} color={a.category.color} category={a.category.name} rounded="rounded-lg" />
                  )}
                </div>
                <div className="min-w-0 py-1">
                  <p className="text-[11px] uppercase tracking-wider text-mist-500">{a.category.name}</p>
                  <h3 className="mt-1 font-semibold group-hover:text-gold-200">{a.name}</h3>
                  {a.description && <p className="mt-1 line-clamp-2 text-xs text-mist-400">{a.description}</p>}
                  <p className="mt-2 text-xs text-mist-500 num">{a._count.cards} cards</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold"><ShoppingBag className="h-5 w-5 text-gold-300" /> Disponíveis agora</h2>
        {listings.items.length ? <ListingGrid items={listings.items} /> : <EmptyState title="Nada à venda no momento" description={`@${user.username} ainda não anunciou cards.`} />}
      </section>
    </div>
  );
}
