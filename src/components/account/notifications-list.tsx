"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/app/actions/market";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

type N = { id: string; title: string; body: string | null; link: string | null; readAt: Date | null; createdAt: Date; type: string };

export function NotificationsList({ items }: { items: N[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div>
      {unread > 0 && (
        <div className="mb-4 flex justify-end">
          <button type="button" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })} className="text-xs font-semibold text-gold-300 hover:text-gold-200">
            Marcar todas como lidas ({unread})
          </button>
        </div>
      )}
      <ul className="surface divide-y divide-white/5">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              href={n.link ?? "#"}
              onClick={() => !n.readAt && markNotificationsReadAction(n.id)}
              className={cn("flex gap-4 px-5 py-4 transition hover:bg-white/[0.02]", !n.readAt && "bg-gold-400/[0.03]")}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-ink-600" : "bg-gold-400")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", n.readAt ? "text-mist-300" : "font-semibold text-mist-100")}>{n.title}</span>
                {n.body && <span className="mt-0.5 block text-xs text-mist-400">{n.body}</span>}
              </span>
              <span className="shrink-0 text-[11px] text-mist-500" suppressHydrationWarning>{timeAgo(n.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
