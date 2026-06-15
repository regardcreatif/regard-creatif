const CACHE_NAME = 'logomaker-v4';
const URLS_TO_CACHE = [
    '.',
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
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(URLS_TO_CACHE).catch(err => console.warn('Certaines ressources non mises en cache :', err)))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(e.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(e.request, responseToCache);
                            });
                        return response;
                    })
                    .catch(() => {
                        if (e.request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                        return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});