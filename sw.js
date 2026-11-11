const CACHE_NAME = 'nizamcraft-cache-v9';

const LOCAL_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
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
    '/src/utils/gameData.js',
    '/src/utils/icons.js',
    '/src/assets/icon.svg'
];

const EXTERNAL_ASSETS = [
    'https://unpkg.com/three@0.152.0/build/three.module.js',
    'https://unpkg.com/three@0.152.0/examples/jsm/controls/PointerLockControls.js',
    'https://unpkg.com/simplex-noise@4.0.3/dist/esm/simplex-noise.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(LOCAL_ASSETS);
            await Promise.allSettled(EXTERNAL_ASSETS.map(url => cache.add(url)));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : undefined))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);
    const isSameOrigin = url.origin === self.location.origin;

    if (isSameOrigin) {
        // Network-first for app files so code updates apply immediately while offline still falls back to cache
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request, { ignoreSearch: true }))
        );
        return;
    }

    // Cache-first for version-pinned external CDN modules
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type !== 'error') {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return response;
            });
        })
    );
});
