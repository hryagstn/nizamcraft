const CACHE_NAME = 'nizamcraft-cache-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/src/index.css',
    '/src/main.js',
    '/src/world/world.js',
    '/src/render/renderer.js',
    '/src/player/player.js',
    '/src/entities/mob.js',
    '/src/entities/tnt.js',
    '/src/utils/audio.js',
    '/src/utils/noise.js',
    '/src/utils/textures.js',
    '/src/assets/icon.svg',
    '/manifest.json',
    // External CDNs
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@400;500;700&display=swap',
    'https://unpkg.com/three@0.152.0/build/three.module.js',
    'https://unpkg.com/three@0.152.0/examples/jsm/controls/PointerLockControls.js',
    'https://unpkg.com/simplex-noise@4.0.3/dist/esm/simplex-noise.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension scheme or other non-http schemes
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(() => {
                // Offline fallback if not in cache
            });
        })
    );
});
