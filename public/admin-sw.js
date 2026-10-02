const CACHE = "dfl-admin-v19";
const SHELL = ["/admin", "/admin-manifest.webmanifest", "/admin-icon-192x192.png", "/admin-icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("dfl-admin-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(async () => (await caches.match(request)) || (await caches.match("/admin"))));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || /admin-(icon|apple)/.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy=response.clone(); caches.open(CACHE).then((cache)=>cache.put(request,copy)); return response; })));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "DFL_ADMIN_NOTIFY") return;
  const payload = event.data.payload || {};
  event.waitUntil(self.registration.showNotification(payload.title || "DFL Admin", {
    body: payload.body || "Há uma atualização na operação.",
    tag: payload.tag || "dfl-admin-operation",
    renotify: true,
    icon: "/admin-icon-192x192.png",
    badge: "/notification-icon.png",
    vibrate: [180, 90, 180],
    data: { url: payload.url || "/admin" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
