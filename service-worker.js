// Define um nome para o cache do seu aplicativo
const CACHE_NAME = 'portal-uziel-cache-v2';

// Lista de todos os arquivos que o seu aplicativo precisa para funcionar offline
const urlsToCache = [
  './',
  './index.html',
  './3.png',
  './4.jpg',
  './5.png',
  './6.png',
  './manifest.json'
];

// Evento 'install': é disparado quando o Service Worker é instalado pela primeira vez.
self.addEventListener('install', event => {
  // Espera até que o cache seja aberto e todos os arquivos sejam armazenados.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto com sucesso');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': é disparado toda vez que o aplicativo tenta buscar um arquivo (uma imagem, um script, etc.).
self.addEventListener('fetch', event => {
  event.respondWith(
    // Tenta encontrar o arquivo no cache primeiro.
    caches.match(event.request)
      .then(response => {
        // Se encontrar no cache, retorna o arquivo do cache.
        if (response) {
          return response;
        }
        // Se não encontrar, busca o arquivo na internet.
        return fetch(event.request);
      })
  );
});