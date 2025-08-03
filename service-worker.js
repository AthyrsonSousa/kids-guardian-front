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

// Refatorado para corrigir o erro
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // A nova verificação:
  // Intercepta apenas requisições GET que são do mesmo domínio da aplicação
  // e que não são para a API.
  if (
    request.method !== 'GET' || 
    url.origin !== location.origin || 
    url.pathname.includes('/api/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(error => {
        console.error('Erro de fetch: ', error);
        return caches.match('/index.html');
      });
    })
  );
});
