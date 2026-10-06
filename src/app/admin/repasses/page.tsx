import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { RowLink, Table, Td } from "@/components/admin/table";
import { PageHeader, Stat } from "@/components/ui/misc";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { PIX_KEY_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Repasses · Admin" };

export default async function PayoutsPage() {
  const [pending, recent] = await Promise.all([
    db.order.findMany({
      where: { payoutStatus: "PENDING" },
      orderBy: { deliveredAt: "asc" },
      include: { card: { select: { name: true } }, seller: { select: { id: true, username: true, sellerProfile: { select: { legalName: true, pixKey: true, pixKeyType: true } } } } },
    }),
    db.order.findMany({ where: { payoutStatus: "PAID" }, orderBy: { payoutAt: "desc" }, take: 20, include: { seller: { select: { username: true } } } }),
  ]);
  const total = pending.reduce((a, o) => a + o.sellerNetCents, 0);
  const bySeller = new Map<string, { username: string; legalName?: string; pix?: string; total: number; count: number }>();
  for (const o of pending) {
    const s = bySeller.get(o.sellerId) ?? { username: o.seller.username, legalName: o.seller.sellerProfile?.legalName, pix: o.seller.sellerProfile ? `${PIX_KEY_TYPE_LABELS[o.seller.sellerProfile.pixKeyType]}: ${o.seller.sellerProfile.pixKey}` : undefined, total: 0, count: 0 };
    s.total += o.sellerNetCents;
    s.count++;
    bySeller.set(o.sellerId, s);
  }
  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Repasses a vendedores" description="Pedidos entregues aguardando o PIX para o vendedor (valor do item − comissão + frete). Registre cada repasse no pedido." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="A repassar" value={formatBRL(total)} tone="gold" />
        <Stat label="Pedidos pendentes" value={pending.length} tone="cyan" />
        <Stat label="Vendedores" value={bySeller.size} tone="violet" />
      </div>

      {bySeller.size > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">Por vendedor</h2>
          <Table head={["Vendedor", "Titular", "Chave PIX", "Pedidos", "Total"]}>
            {[...bySeller.entries()].map(([id, s]) => (
              <tr key={id}>
                <Td><Link href={`/admin/usuarios/${id}`} className="hover:text-gold-200">@{s.username}</Link></Td>
                <Td className="text-mist-400">{s.legalName ?? "—"}</Td>
                <Td className="font-mono text-xs">{s.pix ?? <span className="text-warn">sem dados de repasse</span>}</Td>
                <Td className="num">{s.count}</Td>
                <Td className="font-semibold text-gold-300 num">{formatBRL(s.total)}</Td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <h2 className="mb-3 text-sm font-semibold">Pedidos aguardando repasse</h2>
      <Table head={["Pedido", "Card", "Vendedor", "Entregue em", "Valor"]} empty={pending.length === 0}>
        {pending.map((o) => (
          <tr key={o.id}>
            <Td><RowLink href={`/admin/pedidos/${o.id}`}><span className="font-mono text-xs">#{o.code}</span></RowLink></Td>
            <Td>{o.card.name}</Td>
            <Td className="text-mist-400">@{o.seller.username}</Td>
            <Td className="text-xs text-mist-400">{o.deliveredAt ? formatDateTime(o.deliveredAt) : "—"}</Td>
            <Td className="font-semibold text-gold-300 num">{formatBRL(o.sellerNetCents)}</Td>
          </tr>
        ))}
      </Table>

      {recent.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold">Últimos repasses feitos</h2>
          <Table head={["Pedido", "Vendedor", "Data", "Identificador", "Valor"]}>
            {recent.map((o) => (
              <tr key={o.id}>
                <Td><RowLink href={`/admin/pedidos/${o.id}`}><span className="font-mono text-xs">#{o.code}</span></RowLink></Td>
                <Td className="text-mist-400">@{o.seller.username}</Td>
                <Td className="text-xs text-mist-400">{o.payoutAt ? formatDateTime(o.payoutAt) : "—"}</Td>
                <Td className="font-mono text-xs">{o.payoutReference}</Td>
                <Td className="num">{formatBRL(o.sellerNetCents)}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}
