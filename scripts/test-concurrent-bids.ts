/**
 * Teste de integridade de lances e leilões sob concorrência.
 * Cria dados próprios (prefixo "zz_test_") e verifica:
 *  - lances simultâneos com o MESMO valor → apenas 1 aceito;
 *  - rajada de lances concorrentes crescentes → histórico consistente;
 *  - vendedor não pode dar lance; líder não pode cobrir a si mesmo;
 *  - histórico de lances é imutável (UPDATE/DELETE bloqueados no banco);
 *  - encerramento concorrente gera exatamente 1 pedido e transfere o card;
 *  - lance após o encerramento é rejeitado.
 *
 *   npm run test:bids
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { closeAuction, placeBid } from "../src/server/modules/auctions";
import { createListing } from "../src/server/modules/listings";
import { buyNow } from "../src/server/modules/listings";
import { adminConfirmPayment, adminRegisterPayout, confirmDelivery, markShipped, postOrderMessage, reportPayment, saveShippingAddress } from "../src/server/modules/orders";
import { DomainError } from "../src/server/errors";
import { toLocalInput } from "../src/lib/dates";

let failures = 0;
const check = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

async function expectDomainError(p: Promise<unknown>, label: string) {
  try {
    await p;
    check(false, `${label} (deveria falhar)`);
  } catch (e) {
    check(e instanceof DomainError, `${label} → "${(e as Error).message}"`);
  }
}

async function main() {
  const tag = `zz_test_${Date.now().toString(36)}`;
  const category = await db.category.findFirstOrThrow({ where: { active: true } });
  const mkUser = (i: number | string) =>
    db.user.create({ data: { name: `Teste ${i}`, username: `${tag}_${i}`.slice(0, 24), email: `${tag}_${i}@test.local`, passwordHash: "x" } });

  const seller = await mkUser("s");
  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });

  console.log("\n0) Só vendedor aprovado pode anunciar");
  const c0 = await db.card.create({ data: { ownerId: seller.id, categoryId: category.id, name: `${tag} card 0`, condition: "NEW" } });
  await expectDomainError(createListing({ id: seller.id, role: "USER" }, c0.id, { type: "DIRECT_SALE", price: "10" }, null), "anunciar sem aprovação");
  await db.user.update({ where: { id: seller.id }, data: { sellerStatus: "APPROVED" } });
  await db.sellerProfile.create({ data: { userId: seller.id, applicationId: `test-${seller.id}`, personType: "PF", legalName: "Teste", document: "52998224725", city: "SP", state: "SP", pixKeyType: "CPF", pixKey: "52998224725" } });
  const bidders = await Promise.all(Array.from({ length: 25 }, (_, i) => mkUser(i)));
  const card = await db.card.create({ data: { ownerId: seller.id, categoryId: category.id, name: `${tag} card`, condition: "NEW" } });
  const listing = await createListing(
    { id: seller.id, role: "USER" },
    card.id,
    { type: "AUCTION", startingBid: "100", minIncrement: "10", startsAt: "", endsAt: toLocalInput(new Date(Date.now() + 3 * 3_600_000)) },
    null,
  );
  const auctionId = listing.auctionId!;

  console.log("\n1) 25 lances simultâneos com o mesmo valor (R$ 100)");
  const same = await Promise.allSettled(bidders.map((b) => placeBid(b.id, auctionId, "100", null)));
  const ok1 = same.filter((r) => r.status === "fulfilled").length;
  check(ok1 === 1, `apenas 1 aceito (aceitos: ${ok1})`);

  console.log("\n2) Rajada concorrente de lances crescentes");
  const burst = await Promise.allSettled(
    bidders.map((b, i) => placeBid(b.id, auctionId, String(110 + i * 10), null)),
  );
  const ok2 = burst.filter((r) => r.status === "fulfilled").length;
  console.log(`  (${ok2} aceitos, ${burst.length - ok2} rejeitados por concorrência/mínimo)`);
  const nonDomain = burst.filter((r) => r.status === "rejected" && !(r.reason instanceof DomainError));
  check(nonDomain.length === 0, "nenhum erro inesperado (só erros de regra de negócio)");

  const a = await db.auction.findUniqueOrThrow({ where: { id: auctionId } });
  const bids = await db.bid.findMany({ where: { auctionId }, orderBy: { createdAt: "asc" } });
  const max = Math.max(...bids.map((b) => b.amountCents));
  check(a.bidCount === bids.length, `bidCount (${a.bidCount}) = lances gravados (${bids.length})`);
  check(a.currentBidCents === max, `lance atual (${a.currentBidCents}) = maior lance (${max})`);
  let monotonic = true;
  for (let i = 1; i < bids.length; i++) {
    if (bids[i]!.amountCents < bids[i - 1]!.amountCents + a.minIncrementCents) monotonic = false;
    if (bids[i]!.bidderId === bids[i - 1]!.bidderId) monotonic = false;
  }
  check(monotonic, "cada lance supera o anterior pelo incremento e ninguém cobre a si mesmo");
  const top = bids.at(-1)!;
  check(a.currentBidderId === top.bidderId, "líder do leilão = autor do último lance");

  console.log("\n3) Regras de permissão");
  await expectDomainError(placeBid(seller.id, auctionId, String(max / 100 + 100), null), "vendedor dando lance");
  await expectDomainError(placeBid(top.bidderId, auctionId, String(max / 100 + 100), null), "líder cobrindo o próprio lance");
  await expectDomainError(placeBid(bidders.find((b) => b.id !== top.bidderId)!.id, auctionId, String(max / 100 + 1), null), "lance abaixo do incremento");

  console.log("\n4) Histórico imutável (direto no banco)");
  const tryUpdate = await db.$executeRawUnsafe(`UPDATE bids SET amount_cents = 1 WHERE id = $1`, top.id).then(() => "ok", (e: Error) => e.message);
  check(tryUpdate !== "ok", "UPDATE em bids bloqueado");
  const tryDelete = await db.$executeRawUnsafe(`DELETE FROM bids WHERE id = $1`, top.id).then(() => "ok", (e: Error) => e.message);
  check(tryDelete !== "ok", "DELETE em bids bloqueado");

  console.log("\n5) Encerramento concorrente");
  await db.$executeRawUnsafe(`UPDATE auctions SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' WHERE id = $1`, auctionId);
  await Promise.allSettled([1, 2, 3, 4, 5].map(() => closeAuction(auctionId)));
  const orders = await db.order.findMany({ where: { auctionId } });
  const after = await db.auction.findUniqueOrThrow({ where: { id: auctionId } });
  const cardAfter = await db.card.findUniqueOrThrow({ where: { id: card.id } });
  check(orders.length === 1, `exatamente 1 pedido (${orders.length})`);
  check(after.status === "ENDED" && after.winnerId === top.bidderId, "leilão ENDED com o vencedor correto");
  check(orders[0]?.status === "AWAITING_PAYMENT", "pedido aguardando pagamento");
  check(cardAfter.ownerId === seller.id, "card continua com o vendedor até a entrega");
  await expectDomainError(placeBid(bidders[0]!.id, auctionId, "99999", null), "lance após encerramento");
  await expectDomainError(createListing({ id: seller.id, role: "USER" }, card.id, { type: "DIRECT_SALE", price: "10" }, null), "reanunciar card com pedido em andamento");

  console.log("\n5b) Fluxo do pedido: pagamento → envio → entrega → repasse");
  const o = orders[0]!;
  const buyer = top.bidderId;
  const fakeReceipt = `/api/private/receipts/${buyer}/abcdefghijklmnop.png`;
  await expectDomainError(reportPayment(buyer, o.id, fakeReceipt, null), "comprovante antes do endereço");
  await saveShippingAddress(buyer, o.id, { shipName: "Teste", shipZip: "01001000", shipStreet: "Praça da Sé", shipNumber: "1", shipDistrict: "Sé", shipCity: "São Paulo", shipState: "SP" });
  await expectDomainError(reportPayment(buyer, o.id, `/api/private/receipts/${seller.id}/abcdefghijklmnop.png`, null), "comprovante de outro usuário");
  await reportPayment(buyer, o.id, fakeReceipt, null);
  await expectDomainError(markShipped(seller.id, o.id, { carrier: "Correios", trackingCode: "AA123BR" }, null), "enviar antes da confirmação do pagamento");
  const [c1, c2] = await Promise.allSettled([adminConfirmPayment(admin.id, o.id, null), adminConfirmPayment(admin.id, o.id, null)]);
  check([c1, c2].filter((r) => r.status === "fulfilled").length === 1, "confirmação de pagamento concorrente aplicada uma vez");
  await expectDomainError(markShipped(bidders.find((b) => b.id !== seller.id && b.id !== buyer)!.id, o.id, { carrier: "Jadlog", trackingCode: "1234" }, null), "terceiro tentando marcar envio");
  await markShipped(seller.id, o.id, { carrier: "Correios", trackingCode: "AA123BR" }, null);
  await confirmDelivery(buyer, o.id, null);
  const delivered = await db.order.findUniqueOrThrow({ where: { id: o.id } });
  const cardDelivered = await db.card.findUniqueOrThrow({ where: { id: card.id } });
  check(delivered.status === "DELIVERED" && delivered.payoutStatus === "PENDING", "entregue com repasse pendente");
  check(cardDelivered.ownerId === buyer, "card transferido ao comprador na entrega");
  check(delivered.feeCents === Math.round((delivered.amountCents * delivered.commissionBps) / 10000) && delivered.sellerNetCents === delivered.amountCents - delivered.feeCents + delivered.shippingCents, `comissão ${delivered.commissionBps / 100}% calculada (${delivered.feeCents} de ${delivered.amountCents})`);
  await adminRegisterPayout(admin.id, o.id, "E2E-TESTE-123", null);
  await expectDomainError(adminRegisterPayout(admin.id, o.id, "E2E-TESTE-123", null), "repasse duplicado");
  check((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status === "COMPLETED", "pedido concluído após repasse");
  await expectDomainError(postOrderMessage({ id: bidders[1]!.id === buyer ? bidders[2]!.id : bidders[1]!.id, role: "USER" }, o.id, "oi"), "terceiro no chat do pedido");
  const m = await postOrderMessage({ id: buyer, role: "USER" }, o.id, "me chama no zap 11 98765-4321 ou teste@gmail.com");
  const last = await db.orderEvent.findFirstOrThrow({ where: { orderId: o.id, type: "MESSAGE" }, orderBy: { createdAt: "desc" } });
  check(m.masked && !/98765|gmail/.test(last.body ?? ""), `contatos removidos da mensagem → "${last.body}"`);

  console.log("\n6) Compra direta concorrente");
  const card2 = await db.card.create({ data: { ownerId: seller.id, categoryId: category.id, name: `${tag} card 2`, condition: "NEW" } });
  const l2 = await createListing({ id: seller.id, role: "USER" }, card2.id, { type: "DIRECT_SALE", price: "50" }, null);
  const buys = await Promise.allSettled(bidders.slice(0, 10).map((b) => buyNow(b.id, l2.id, 5000, null)));
  const rejected = buys.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason?.message);
  if (buys.every((r) => r.status === "rejected")) console.log("   motivos:", [...new Set(rejected)]);
  check(buys.filter((r) => r.status === "fulfilled").length === 1, "apenas 1 compra concluída");
  check((await db.order.count({ where: { listingId: l2.id } })) === 1, "apenas 1 pedido para o anúncio");

  console.log(failures ? `\n✗ ${failures} verificação(ões) falharam` : "\n✓ Todas as verificações passaram");
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(failures ? 1 : 0);
  });
