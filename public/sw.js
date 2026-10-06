/* PVNE Cards — service worker do app (PWA)
 *
 * Estratégia (segura para um marketplace com dados ao vivo e área logada):
 *  - Páginas (HTML) e /api/*: SEMPRE da rede. Nada pessoal fica guardado no aparelho.
 *    Sem internet, mostra /offline.html.
 *  - /_next/static/* (JS/CSS com hash no nome): cache permanente — abre o app mais rápido.
 *  - Ícones, logo e fotos públicas dos cards (/uploads/*): mostra do cache e atualiza em segundo plano.
 *  - Notificações push: exibe e, ao tocar, abre a página certa dentro do app.
 *
 * Ao alterar este arquivo, aumente VERSION para os aparelhos baixarem a nova versão.
 */
const VERSION = "v1";
const STATIC = `pvne-static-${VERSION}`;
const IMAGES = `pvne-images-${VERSION}`;
const KEEP = [STATIC, IMAGES];
const MAX_IMAGES = 200;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/logo.svg", "/icon.svg", "/pwa/icon-192.png", "/pwa/badge-96.png"];
// Registrado como /sw.js?dev=1 no "npm run dev": não guarda JS/CSS (mudam a cada edição), só offline + push
const DEV = new URL(self.location.href).searchParams.has("dev");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("pvne-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // inclui documentos privados: nunca em cache

  if (req.mode === "navigate") {
    event.respondWith(navigation(event));
    return;
  }
  if (DEV) return;
  // Requisições de dados do Next (RSC) sempre da rede
  if (url.searchParams.has("_rsc") || req.headers.get("RSC")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
  } else if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(staleWhileRevalidate(event, IMAGES, MAX_IMAGES));
  } else if (url.pathname.startsWith("/pwa/") || /^\/(logo|icon)\.svg$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, STATIC));
  }
});

async function navigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    return cached || new Response("Sem conexão", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(event, cacheName, max) {
  const req = event.request;
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then(async (res) => {
      if (res.ok && res.type === "basic") {
        await cache.put(req, res.clone());
        if (max) await trim(cache, max);
      }
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return (await update) || new Response("", { status: 504 });
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/* ---------------- Notificações push ---------------- */

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : "" };
  }
  const title = d.title || "PVNE Cards";
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: d.body || "",
        icon: "/pwa/icon-192.png",
        badge: "/pwa/badge-96.png",
        tag: d.tag || undefined,
        renotify: Boolean(d.tag),
        timestamp: d.ts || Date.now(),
        lang: "pt-BR",
        data: { url: d.url || "/conta/notificacoes" },
      });
      if (typeof d.unread === "number" && self.navigator.setAppBadge) {
        await (d.unread > 0 ? self.navigator.setAppBadge(d.unread) : self.navigator.clearAppBadge()).catch(() => {});
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = all.find((c) => new URL(c.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        if (same.url !== target && "navigate" in same) return same.navigate(target).catch(() => self.clients.openWindow(target));
        return;
      }
      return self.clients.openWindow(target);
    })(),
  );
});

// O navegador trocou a inscrição (expirou/rotacionou): registra a nova no servidor
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const opts = event.oldSubscription && event.oldSubscription.options;
      if (!opts) return;
      const sub = event.newSubscription || (await self.registration.pushManager.subscribe(opts));
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), replaces: event.oldSubscription && event.oldSubscription.endpoint }),
      });
    })().catch(() => {}),
  );
});
