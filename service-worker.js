const CACHE_NAME = 'kids-guardian-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/frontend.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const MAX_DYNAMIC_CACHE_ITEMS = 50; // Limite para cache dinâmico

// Limpa cache dinâmico para limitar tamanho
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxItems); // recursivo até ficar no limite
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== location.origin ||
    url.pathname.includes('/api/')
  ) {
    return; // Ignora outros requests
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(request);
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
        return networkResponse;
      }

      const responseClone = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseClone);
      await limitCacheSize(CACHE_NAME, MAX_DYNAMIC_CACHE_ITEMS);

      return networkResponse;
    } catch (error) {
      console.error('Fetch failed:', error);

      // Fallbacks para imagens ou outros arquivos estáticos
      if (request.destination === 'image') {
        return caches.match('/icons/icon-192.png'); // imagem fallback
      }

      return caches.match('/index.html');
    }
  })());
});
