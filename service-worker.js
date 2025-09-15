/*
================================================================
SERVICE-WORKER.JS - AWWWARDS REBUILD 2025 (ENHANCED & ROBUST)
- Implements a robust caching strategy for offline availability.
- Caches the app shell and API data for a seamless, instant experience.
- Refined fetch logic to avoid caching dynamic AI responses.
================================================================
*/

const APP_CACHE_NAME = 'pcinegpt-shell-v3';
const DATA_CACHE_NAME = 'pcinegpt-data-v3';

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
    console.log('[Service Worker] Install event fired.');
    event.waitUntil(
        caches.open(APP_CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching essential app shell assets.');
                return cache.addAll(APP_SHELL_URLS);
            })
            .catch(error => {
                console.error('[Service Worker] Failed to cache app shell:', error);
            })
    );
});

/**
 * ACTIVATE Event
 * Fired when the service worker is activated. Cleans up old caches.
 */
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate event fired.');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== APP_CACHE_NAME && cache !== DATA_CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
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

    // Ignore non-GET requests and requests from browser extensions
    if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
        return;
    }
    
    // Strategy 1: For TMDB API calls, use Network First, Falling Back to Cache.
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
                        console.log(`[Service Worker] Network failed for ${url}. Serving from cache.`);
                        return cache.match(event.request);
                    });
            })
        );
        return;
    }

    // Strategy 2: For App Shell resources, use Cache First, Falling Back to Network.
    // This makes the app load instantly from the cache.
    // We explicitly avoid caching the Gemini API here as its responses are dynamic.
    if (APP_SHELL_URLS.includes(url.pathname) || url.hostname === 'api.fontshare.com' || url.hostname === 'unpkg.com') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Return cached response if found, otherwise fetch from the network.
                    return response || fetch(event.request);
                })
        );
    }
});
