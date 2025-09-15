/*
================================================================
SERVICE-WORKER.JS - AWWWARDS REBUILD 2025
- Implements a robust caching strategy for offline availability.
- Caches the app shell and API data for a seamless, instant experience.
================================================================
*/

const APP_CACHE_NAME = 'pcinegpt-shell-v2';
const DATA_CACHE_NAME = 'pcinegpt-data-v2';

// A list of all essential files that make up the app's user interface.
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/main.css',
    '/app.js',
    '/api.js',
    '/gemini.js',
    '/trakt.js',
    '/storage.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500&f[]=satoshi@700,500,400&display=swap',
    'https://unpkg.com/lucide@latest'
];

/**
 * INSTALL Event
 * Fired when the service worker is first installed. Caches the app shell.
 */
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(APP_CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(APP_SHELL_URLS);
            })
    );
});

/**
 * ACTIVATE Event
 * Fired when the service worker is activated. Cleans up old caches.
 */
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== APP_CACHE_NAME && cache !== DATA_CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

/**
 * FETCH Event
 * Fired for every network request. Implements caching strategies.
 */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Strategy 1: For API calls to TMDB, use Network First, Falling Back to Cache.
    // This ensures data is fresh when online but still available offline.
    if (url.hostname === 'api.themoviedb.org') {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(response => {
                        // If the network request is successful, clone and cache the response.
                        if (response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    })
                    .catch(() => {
                        // If the network fails, serve the matched response from the cache.
                        return cache.match(event.request);
                    });
            })
        );
        return;
    }

    // Strategy 2: For App Shell resources, use Cache First, Falling Back to Network.
    // This makes the app load instantly from the cache.
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found, otherwise fetch from the network.
                return response || fetch(event.request);
            })
    );
});
