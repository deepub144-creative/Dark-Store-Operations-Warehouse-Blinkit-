const CACHE_NAME = "auditx-ios-shell-v1";
const CORE_SHELL_ASSETS = [
  "/ordering",
  "/picker",
  "/rider",
  "/manifest.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/upi-icons/phonepe.png",
  "/upi-icons/gpay.png",
  "/upi-icons/paytm.png",
  "/upi-icons/upi.png",
  "/auditx-logo.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(CORE_SHELL_ASSETS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache live sync/order/auth API traffic
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for static assets & immutable Next chunks
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/upi-icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/choclates/") ||
    url.pathname.startsWith("/frames/") ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Network-first with cached shell fallback for navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/ordering"))
        )
    );
  }
});

