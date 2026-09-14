// AquaCon PWA Service Worker for Offline Support
const CACHE_NAME = 'aquacon-cache-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Do not cache API routes or auth endpoints in service worker cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first strategy with cache fallback for navigation and static assets
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and put into cache if valid response
        if (response && response.status === 200 && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigating and offline, return cached dashboard or root
        if (request.mode === 'navigate') {
          const fallback = (await caches.match('/dashboard')) || (await caches.match('/'));
          if (fallback) return fallback;
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
