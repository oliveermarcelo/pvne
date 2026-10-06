import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listNotifications } from "@/server/modules/notifications";
import { NotificationsList } from "@/components/account/notifications-list";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PushToggle } from "@/components/pwa/push-toggle";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUserPage();
  const items = await listNotifications(user.id, 100);
  return (
    <>
      <PageHeader eyebrow="Atividade" title="Notificações" />
      <PushToggle className="mb-6" />
      {items.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title="Tudo tranquilo" description="Propostas, lances e resultados de leilões aparecem aqui." /> : <NotificationsList items={items} />}
    </>
  );
}
