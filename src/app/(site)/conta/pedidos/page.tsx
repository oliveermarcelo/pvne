import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listOrders } from "@/server/modules/orders";
import { CardArt } from "@/components/cards/card-art";
import { Alert, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/labels";

export const metadata: Metadata = { title: "Compras e vendas" };
export const dynamic = "force-dynamic";

const NEXT_STEP: Record<string, { buyer?: string; seller?: string }> = {
  AWAITING_PAYMENT: { buyer: "Pague via PIX para garantir o card", seller: "Aguardando pagamento do comprador" },
  PAYMENT_REVIEW: { buyer: "Pagamento em conferência", seller: "Aguardando confirmação do pagamento" },
  PAID: { buyer: "Aguardando o envio", seller: "Envie o card e informe o rastreio" },
  SHIPPED: { buyer: "Confirme quando receber", seller: "Aguardando o comprador receber" },
  DELIVERED: { buyer: "Concluído", seller: "Repasse em processamento" },
  DISPUTED: { buyer: "Em análise pela PVNE", seller: "Em análise pela PVNE" },
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; comprado?: string }> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const tab = sp.tab === "vendas" ? "seller" : "buyer";
  const orders = await listOrders(user.id, tab);
  const pending = orders.filter((o) => (tab === "buyer" ? o.status === "AWAITING_PAYMENT" : o.status === "PAID")).length;
  return (
    <>
      <PageHeader eyebrow="Pedidos" title="Compras e vendas" description="Todo pagamento passa pela PVNE: o vendedor só recebe depois que o comprador confirma a entrega." />
      {sp.comprado && <Alert tone="ok" className="mb-6">Compra registrada! Abra o pedido para pagar via PIX e garantir o card.</Alert>}
      {pending > 0 && <Alert tone="warn" className="mb-6">{tab === "buyer" ? `Você tem ${pending} pedido(s) aguardando pagamento.` : `Você tem ${pending} venda(s) pagas aguardando envio.`}</Alert>}
      <Tabs active={tab} items={[{ key: "buyer", label: "Minhas compras", href: "/conta/pedidos" }, { key: "seller", label: "Minhas vendas", href: "/conta/pedidos?tab=vendas" }]} />
      {orders.length === 0 ? (
        <EmptyState icon={<Store className="h-6 w-6" />} title={tab === "buyer" ? "Nenhuma compra ainda" : "Nenhuma venda ainda"} />
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => {
            const other = tab === "buyer" ? o.seller : o.buyer;
            const hint = NEXT_STEP[o.status]?.[tab === "buyer" ? "buyer" : "seller"];
            return (
              <Link key={o.id} href={`/conta/pedidos/${o.id}`} className="surface flex items-center gap-4 p-4 transition hover:border-white/15">
                <div className="w-12 shrink-0"><CardArt src={o.card.images[0]?.url} name={o.card.name} rounded="rounded-lg" /></div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    <Badge>{ORDER_SOURCE_LABELS[o.source]}</Badge>
                  </div>
                  <p className="truncate font-semibold">{o.card.name}{o.quantity > 1 ? ` × ${o.quantity}` : ""}</p>
                  <p className="truncate text-xs text-mist-500">#{o.code} · {tab === "buyer" ? "vendedor" : "comprador"} @{other.username} · {formatDateTime(o.createdAt)}</p>
                  {hint && <p className="mt-1 text-xs font-medium text-gold-300">{hint}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-mist-500">{tab === "buyer" ? "Total" : "Você recebe"}</p>
                  <p className="font-display text-lg font-semibold text-gold-300 num">{formatBRL(tab === "buyer" ? o.totalCents || o.amountCents : o.sellerNetCents || o.amountCents)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-mist-500" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
