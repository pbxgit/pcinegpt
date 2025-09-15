/*
================================================================
SERVICE-WORKER.JS - PWA CORE (REFINED)
- The core of the Progressive Web App functionality.
- Implements a "cache-first" strategy for the app shell.
- Handles the install, activate, and fetch lifecycle events.
- Ensures the application loads instantly on subsequent visits.
================================================================
*/

// A descriptive and versioned cache name for easier management.
const CACHE_NAME = 'pcinegpt-shell-v1.1';

// A list of all the essential files that make up the app shell.
// This list must be updated if core filenames change.
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
    '/icons/favicon.png',
    '/icons/icon-192x192.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

/**
 * INSTALL Event
 * Fired when the service worker is first installed.
 * Opens a cache and adds all the app shell files to it.
 */
self.addEventListener('install', event => {
    console.log('[Service Worker] Install event fired.');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell files.');
                return cache.addAll(APP_SHELL_URLS);
            })
            .catch(error => {
                console.error('[Service Worker] Failed to cache app shell:', error);
            })
    );
});

/**
 * ACTIVATE Event
 * Fired when the service worker is activated.
 * This is the ideal place to clean up old, unused caches.
 */
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate event fired.');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // If a cache's name is not our current one, we delete it.
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
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
 * Implements a "cache-first" strategy for app shell assets.
 * 1. Look for a matching response in the cache.
 * 2. If found, return it immediately.
 * 3. If not found, fetch it from the network.
 */
self.addEventListener('fetch', event => {
    // We only apply the cache-first strategy to GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // If a cached response is found, return it.
                if (cachedResponse) {
                    // console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
                    return cachedResponse;
                }
                // Otherwise, fetch the request from the network.
                // console.log(`[Service Worker] Fetching from network: ${event.request.url}`);
                return fetch(event.request);
            })
    );
});
