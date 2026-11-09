/* ENVYRA CONTROL — service worker
   - El "cascarón" de la app queda en caché para abrir rápido y sin conexión.
   - Supabase (auth, datos, Edge Functions) NUNCA se cachea: siempre va a la red. */
const VERSION = "envyra-control-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const CDN = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname.endsWith("supabase.co") || u.hostname.endsWith("supabase.in")) return;

  // Pantalla principal: red primero, caché si no hay conexión
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("index.html", copy)); } return res; })
        .catch(() => caches.match("index.html").then(m => m || caches.match("./")))
    );
    return;
  }

  // Archivos propios y librerías/fuentes de CDN: caché al instante y se actualiza en segundo plano
  if (u.origin === location.origin || CDN.includes(u.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION), hit = await c.match(r);
      const net = fetch(r)
        .then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; })
        .catch(() => hit || Response.error());
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    })());
  }
});
