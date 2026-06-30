const CACHE_NAME = 'rc-logo-maker-v1';

// Fichiers à mettre en cache (editor.html retiré — tout est dans index.html)
const STATIC_URLS = [
  './index.html',
  './manifest.json',
  'https://i.postimg.cc/25xvJ3yg/ezgif-5a59033461dfd07d.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
];

// Installation
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_URLS).catch(err => console.warn('[SW] Cache partiel:', err))
    )
  );
});

// Activation — supprime les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Message skipWaiting
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Stratégie : Cache d'abord, réseau en fallback
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne pas intercepter les requêtes non-GET
  if (e.request.method !== 'GET') return;

  // Pour les fichiers HTML locaux → toujours servir index.html depuis le cache
  if (e.request.destination === 'document') {
    e.respondWith(
      caches.match('./index.html').then(cached => {
        if (cached) return cached;
        return fetch(e.request).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // Pour tout le reste → cache d'abord, réseau ensuite
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Mettre en cache les ressources valides
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Image manquante → réponse vide propre
        if (e.request.destination === 'image') {
          return new Response('', { status: 200 });
        }
        return new Response('Hors ligne', { status: 503 });
      });
    })
  );
});
