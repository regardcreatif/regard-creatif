/* =====================================================
   TRINITE CHAT — Service Worker PWA
   Cache-first pour les assets statiques
   Network-first pour les données Supabase
   ===================================================== */

const CACHE_NAME = "trinite-v1";

// Assets à mettre en cache pour le chargement instantané
const STATIC_ASSETS = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
];

// ── Installation : mise en cache des assets ──
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn("[SW] Cache miss:", url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyage des anciens caches ──
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie intelligente ──
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Supabase & APIs externes → réseau d'abord (pas de cache)
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.com") ||
    url.hostname.includes("postimg.cc") ||
    e.request.method !== "GET"
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // Assets statiques → cache d'abord, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
