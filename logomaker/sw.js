const CACHE_NAME = 'logomaker-v2';
const URLS_TO_CACHE = [
    '.',
    'index.html',
    'editor.html',
    'manifest.json',
    'sw.js',
    'https://i.postimg.cc/25xvJ3yg/ezgif-5a59033461dfd07d.png',
    'https://i.postimg.cc/XvTXWs4T/ezgif-com-video-to-gif-converter.gif',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,700;0,9..40,900;1,9..40,300&display=swap'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache ouvert :', CACHE_NAME);
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Suppression de l\'ancien cache :', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
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
                        return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});