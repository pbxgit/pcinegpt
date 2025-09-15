/*
================================================================
SERVICE-WORKER.JS
- The core of the Progressive Web App (PWA).
- Handles caching of the app shell for offline availability.
- Intercepts network requests to serve cached assets first.
================================================================
*/

const CACHE_NAME = 'pcinegpt-v1';

// A list of all the essential files that make up the app shell.
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/main.css',
    '/app.js',
    '/api.js',
    '/icons/favicon.png',
    '/icons/icon-192x192.png' // Key icon for PWA install prompt
];

/**
 * INSTALL Event
 * Fired when the service worker is first installed.
 * Opens a cache and adds the app shell files to it.
 */
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(APP_SHELL_URLS);
            })
    );
});

/**
 * ACTIVATE Event
 * Fired when the service worker is activated.
 * Used for cleaning up old caches.
 */
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
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
 * Fired for every network request made by the page.
 * Implements a "cache-first" strategy:
 * 1. Look for a response in the cache.
 * 2. If found, return it.
 * 3. If not, fetch from the network, and then return.
 */
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found, otherwise fetch from network
                return response || fetch(event.request);
            })
    );
});
