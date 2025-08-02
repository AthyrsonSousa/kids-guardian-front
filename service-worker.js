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

// Instala e salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Remove caches antigos na ativação
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

// Intercepta apenas GET que não sejam API
self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
  );
});
