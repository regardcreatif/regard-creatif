const CACHE_NAME = 'logomaker-v6';
const STATIC_URLS = [
    './index.html',
    './editor.html',
    './manifest.json',
    'https://i.postimg.cc/25xvJ3yg/ezgif-5a59033461dfd07d.png',
    'https://i.postimg.cc/XvTXWs4T/ezgif-com-video-to-gif-converter.gif',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,700;0,9..40,900;1,9..40,300&display=swap',
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@700;900&family=Poppins:wght@400;700;900&family=Bebas+Neue&family=Righteous&family=Oswald:wght@500;700&family=Roboto:wght@400;900&family=League+Spartan:wght@700;900&family=Caveat:wght@700&family=Inter:wght@400;600;700;900&family=Pacifico&family=Abril+Fatface&family=Alfa+Slab+One&family=Lobster&family=Fjalla+One&family=DM+Sans:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Cinzel:wght@400;700&family=Rajdhani:wght@400;700&display=swap'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(STATIC_URLS).catch(err => console.warn('[SW] Pre-cache partiel:', err))
        )
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    const isHTML = e.request.destination === 'document' || url.pathname.endsWith('.html');
    const isSameOrigin = url.origin === self.location.origin;

    if (isHTML && isSameOrigin) {
        // Network-first pour les pages HTML (toujours fraîches si possible)
        e.respondWith(
            fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                return res;
            }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // Cache-first pour tous les autres assets (fontes, icônes, FA)
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                // Ne cache que les réponses valides (évite les réponses opaques corrompues)
                if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return res;
            }).catch(() => {
                if (e.request.destination === 'document') return caches.match('./index.html');
                return new Response('', { status: 503 });
            });
        })
    );
});
