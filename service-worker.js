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

// Refatorado para usar a estratégia Cache First
// Primeiro tenta buscar no cache e, se não encontrar, busca na rede.
self.addEventListener('fetch', event => {
  const { request } = event;

  // Intercepta apenas requisições GET que não sejam da API
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Se o recurso está no cache, devolve-o imediatamente.
      if (cachedResponse) {
        return cachedResponse;
      }

      // Se não está no cache, busca na rede e o salva para uso futuro.
      return fetch(request).then(response => {
        // Verifica se a resposta é válida
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
        // Retorna um fallback caso a requisição falhe
        return caches.match('/index.html');
      });
    })
  );
});
