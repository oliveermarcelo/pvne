/**
 * Teste do fluxo de push (sem aparelho real):
 *   npx tsx scripts/test-push.ts
 * Verifica: fila de envio (sem duplicar entre processos), validação do endereço do serviço de push,
 * criptografia do payload e limpeza de inscrições inválidas.
 */
import "dotenv/config";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import { db } from "../src/server/db";
import { notify } from "../src/server/modules/notifications";
import { dispatchPendingPush, getVapid, isAllowedPushEndpoint } from "../src/server/push";

process.env.PUSH_DISABLED = "1"; // controlamos o despacho manualmente aqui
let fails = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✔" : "✘"} ${m}`);
  if (!c) fails++;
};
const b64u = (b: Buffer) => b.toString("base64url");

async function main() {
  ok(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), "aceita FCM (Chrome/Android)");
  ok(isAllowedPushEndpoint("https://web.push.apple.com/QGx"), "aceita Apple (iPhone)");
  ok(isAllowedPushEndpoint("https://wns2-bl2p.notify.windows.com/w/?token=1"), "aceita Windows (Edge)");
  ok(!isAllowedPushEndpoint("http://fcm.googleapis.com/x"), "recusa http");
  ok(!isAllowedPushEndpoint("https://localhost/x") && !isAllowedPushEndpoint("https://169.254.169.254/x") && !isAllowedPushEndpoint("https://evil.com/fcm.googleapis.com"), "recusa endereços internos/arbitrários");

  const vapid = await getVapid();
  ok(vapid.publicKey.length > 80 && vapid.privateKey.length > 40, "chaves VAPID disponíveis");
  ok((await getVapid()).publicKey === vapid.publicKey, "chaves VAPID estáveis");

  // Criptografia do payload para uma inscrição "de navegador" simulada
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const keys = { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(randomBytes(16)) };
  const details = webpush.generateRequestDetails({ endpoint: "https://fcm.googleapis.com/fcm/send/teste", keys }, JSON.stringify({ title: "Teste" }), { vapidDetails: vapid });
  ok(details.headers["Content-Encoding"] === "aes128gcm" && !!details.headers.Authorization, "payload criptografado e assinado (aes128gcm + VAPID)");

  const user = await db.user.findFirstOrThrow({ where: { username: "eva.coleciona" } });
  await db.pushSubscription.deleteMany({ where: { userId: user.id } });
  const sub = await db.pushSubscription.create({ data: { userId: user.id, endpoint: `https://fcm.googleapis.com/fcm/send/pvne-teste-${Date.now()}`, ...keys } });

  // Fila: 3 avisos, dois "processos" despachando ao mesmo tempo → cada aviso reservado uma única vez
  await db.notification.updateMany({ where: { pushedAt: null }, data: { pushedAt: new Date() } });
  await notify(db, [1, 2, 3].map((i) => ({ userId: user.id, type: "SYSTEM" as const, title: `Teste push ${i}`, link: "/conta/notificacoes" })));
  const [a, b] = await Promise.all([dispatchPendingPush(), dispatchPendingPush()]);
  ok(a + b === 3, `3 avisos reservados no total entre 2 despachantes simultâneos (${a} + ${b})`);
  const pending = await db.notification.count({ where: { userId: user.id, pushedAt: null } });
  ok(pending === 0, "nenhum aviso ficou na fila");

  // O FCM recusa o endereço falso: a inscrição deve ser removida (404/410) ou marcada com falha
  const after = await db.pushSubscription.findUnique({ where: { id: sub.id } });
  ok(!after || after.failures > 0, after ? `inscrição inválida marcada com falha (${after.failures})` : "inscrição inválida removida");

  // Inscrição presa à sessão: sair da conta encerra o push daquele aparelho
  const session = await db.session.create({ data: { id: `teste-${Date.now()}`, userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
  const s2 = await db.pushSubscription.create({ data: { userId: user.id, sessionId: session.id, endpoint: `https://fcm.googleapis.com/fcm/send/pvne-sessao-${Date.now()}`, ...keys } });
  await db.session.delete({ where: { id: session.id } });
  ok(!(await db.pushSubscription.findUnique({ where: { id: s2.id } })), "ao sair da conta a inscrição do aparelho é apagada");

  await db.pushSubscription.deleteMany({ where: { userId: user.id } });
  await db.notification.deleteMany({ where: { userId: user.id, title: { startsWith: "Teste push" } } });
  console.log(fails ? `\n${fails} falha(s)` : "\nTudo certo");
  await db.$disconnect();
  process.exit(fails ? 1 : 0);
}
main();
