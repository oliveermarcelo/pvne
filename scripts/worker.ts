/**
 * Worker: ativa leilões agendados, encerra os vencidos, envia avisos de "acabando",
 * cancela pedidos não pagos no prazo, confirma entregas automaticamente e
 * entrega as notificações push que ficaram na fila. Roda como processo separado (serviço "worker" no Docker).
 *
 *   npm run worker
 *
 * O encerramento é idempotente e protegido por lock de linha, então é seguro
 * rodar mais de uma instância ou combinar com o endpoint /api/cron/auctions.
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { processAuctions } from "../src/server/modules/auctions";
import { processOrders } from "../src/server/modules/orders";
import { dispatchPendingPush } from "../src/server/push";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);
let running = true;
let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const r = await processAuctions();
    if (r.started || r.closed || r.endingSoon) {
      console.log(`[worker] ${new Date().toISOString()} leilões: iniciados=${r.started} encerrados=${r.closed} avisos=${r.endingSoon}`);
    }
    const o = await processOrders();
    if (o.expired || o.autoDelivered) {
      console.log(`[worker] ${new Date().toISOString()} pedidos: expirados=${o.expired} entregas-automáticas=${o.autoDelivered}`);
    }
    const pushed = await dispatchPendingPush();
    if (pushed) console.log(`[worker] ${new Date().toISOString()} push: ${pushed} aviso(s) processado(s)`);
    // Limpeza leve de sessões e tokens expirados
    if (Math.random() < 0.02) {
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
    }
  } catch (e) {
    console.error("[worker] erro no ciclo:", e);
  } finally {
    busy = false;
  }
}

async function main() {
  console.log(`[worker] iniciado — intervalo ${INTERVAL_MS / 1000}s`);
  await tick();
  const timer = setInterval(tick, INTERVAL_MS);
  const stop = async () => {
    if (!running) return;
    running = false;
    clearInterval(timer);
    console.log("[worker] encerrando…");
    while (busy) await new Promise((r) => setTimeout(r, 100));
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main();
