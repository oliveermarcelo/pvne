import type { Metadata } from "next";
import { MarketplaceView } from "@/components/market/marketplace-view";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Marketplace" };
export const dynamic = "force-dynamic";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <div className="container py-10">
      <PageHeader eyebrow="Loja" title="Marketplace" description="Cards à venda, aceitando propostas e em leilão — direto de colecionadores." />
      <MarketplaceView params={params} basePath="/marketplace" />
    </div>
  );
}
