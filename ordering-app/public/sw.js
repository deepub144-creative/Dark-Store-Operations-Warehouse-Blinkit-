const CACHE_NAME = "auditx-ios-shell-v3";
const CORE_STATIC_ASSETS = [
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
      Promise.allSettled(CORE_STATIC_ASSETS.map((url) => cache.add(url)))
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

  // Never intercept API traffic or Next.js immutable build chunks / RSC requests
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    request.headers.get("RSC") === "1"
  ) {
    return;
  }

  // Only cache static brand & icon image assets; always fall back to a valid Response
  const isStaticIconOrImage =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/upi-icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/choclates/") ||
    url.pathname.startsWith("/frames/") ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (isStaticIconOrImage) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached || new Response("", { status: 504, statusText: "Gateway Timeout" }));
      })
    );
    return;
  }

  // Navigation requests always go live to network; never resolve undefined in respondWith
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>AUDIT'X</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#F2F2F7;color:#111827;margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;text-align:center}.card{background:#fff;border-radius:20px;padding:24px;max-width:340px;box-shadow:0 8px 24px rgba(0,0,0,.08)}button{margin-top:14px;width:100%;height:46px;border:0;border-radius:999px;background:#0C831F;color:#fff;font-weight:700;font-size:15px}</style></head><body><div class="card"><h2 style="margin:0 0 8px;font-size:18px">Connection interrupted</h2><p style="margin:0;color:#6B7280;font-size:14px">Tap below to reload AUDIT'X Store.</p><button onclick="location.reload()">Reload Store</button></div></body></html>`,
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          )
      )
    );
  }
});
