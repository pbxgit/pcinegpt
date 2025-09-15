/*
================================================================
SERVICE-WORKER.JS
- The core of the Progressive Web App (PWA).
- Implements a caching strategy for offline availability.
- Caches the app shell and API data for a seamless offline experience.
================================================================
*/

const APP_CACHE_NAME = 'pcinegpt-shell-v1';
const DATA_CACHE_NAME = 'pcinegpt-data-v1';

// A list of all the essential files that make up the app's user interface.
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/main.css',
    '/app.js',
    '/api.js',
    '/gemini.js',
    '/trakt.js',
    '/storage.js',
    '/icons/favicon.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap',
    'https://unpkg.com/lucide@latest'
];

/**
 * INSTALL Event
 * Fired when the service worker is first installed.
 * Opens a cache and adds the app shell files to it for offline use.
 */
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(APP_CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                // addAll() is atomic. If one file fails, the whole operation fails.
                return cache.addAll(APP_SHELL_URLS);
            })
    );
});

/**
 * ACTIVATE Event
 * Fired when the service worker is activated.
 * This is the ideal place to clean up old, unused caches.
 */
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    // Delete any caches that are not the current app or data cache.
                    if (cache !== APP_CACHE_NAME && cache !== DATA_CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // Force the activated service worker to take control of the page immediately.
    return self.clients.claim();
});

/**
 * FETCH Event
 * Fired for every network request made by the page.
 * Implements a caching strategy to serve content offline.
 */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Strategy 1: For API calls (data), use Network First, Falling Back to Cache.
    // This ensures data is fresh when online, but the app is still usable offline.
    if (url.hostname === 'api.themoviedb.org') {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(cache => {
                return fetch(event.request).then(response => {
                    // If the network request is successful, cache a clone of the response.
                    if (response.status === 200) {
                        cache.put(event.request.url, response.clone());
                    }
                    return response;
                }).catch(() => {
                    // If the network request fails (offline), return the cached response if it exists.
                    return caches.match(event.request);
                });
            })
        );
    }
    // Strategy 2: For App Shell resources, use Cache First, Falling Back to Network.
    // This makes the app load instantly from the cache.
    else {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Return the cached response if found, otherwise fetch from the network.
                    return response || fetch(event.request);
                })
        );
    }
});
