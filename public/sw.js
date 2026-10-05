/*
 * Service worker (SPEC 13). Caches only the app shell's static files (fonts, icons, Next static chunks).
 * Never caches /api/* or HTML pages, so no financial data persists after logout.
 * Offline queue: on "sync" it asks open pages to flush; Background Sync falls back to flushing when the app opens.
 */
const STATIC = "static-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(["/icons/icon-192.png", "/icons/icon-512.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/");
  if (!isStatic) return; // network only: pages and API responses are never stored
  e.respondWith(
    caches.open(STATIC).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }),
  );
});

self.addEventListener("sync", (e) => {
  if (e.tag !== "ingest-queue") return;
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((cs) => {
      for (const c of cs) c.postMessage({ type: "flush-offline" });
    }),
  );
});

self.addEventListener("push", (e) => {
  let data = { title: "", body: "", url: "/" };
  try {
    data = { ...data, ...e.data.json() };
  } catch {
    data.body = e.data ? e.data.text() : "";
  }
  e.waitUntil(self.registration.showNotification(data.title || "Notification", { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((cs) => {
      for (const c of cs) if ("focus" in c) return c.navigate(url).then((w) => w && w.focus());
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "logout") e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
});
