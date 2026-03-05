/* STAN:PWA_SW v1 */
const CACHE_NAME = 'stan-pwa-v1';

const ASSETS = [
  '/index.html',
  '/me.html',
  '/styles.css',
  '/app.js',
  '/paywall.js',
  '/storage.js',
  '/share.js',
  '/pwa-banner.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API zawsze network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    })());
    return;
  }

  // statyki cache-first
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const res = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, res.clone());
    return res;
  })());
});