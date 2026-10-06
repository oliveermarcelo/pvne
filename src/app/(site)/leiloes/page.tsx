import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { MarketplaceView } from "@/components/market/marketplace-view";
import { PageHeader, Tabs } from "@/components/ui/misc";
import { sp } from "@/lib/utils";

export const metadata: Metadata = { title: "Leilões" };
export const dynamic = "force-dynamic";

export default async function AuctionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const fase = sp(params.fase) === "agendados" ? "agendados" : "ao-vivo";
  return (
    <div className="container py-10">
      <PageHeader
        eyebrow="Leilões"
        title={<span className="flex items-center gap-3"><Gavel className="h-7 w-7 text-holo-violet" /> Leilões</span>}
        description="Dê seu lance antes do cronômetro zerar. O maior lance válido no encerramento leva o card."
      />
      <Tabs
        active={fase}
        items={[
          { key: "ao-vivo", label: "Ao vivo", href: "/leiloes?fase=ao-vivo" },
          { key: "agendados", label: "Em breve", href: "/leiloes?fase=agendados" },
        ]}
      />
      <MarketplaceView
        params={{ sort: "ending", ...params, fase }}
        basePath="/leiloes"
        lock={{ type: "AUCTION", phase: fase === "agendados" ? "scheduled" : "live" }}
        hideFilters={["type"]}
      />
    </div>
  );
}
