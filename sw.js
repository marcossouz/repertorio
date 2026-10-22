const CACHE = 'repertorio-web-1.8.42-c555042e';
const ASSETS = ["./","./cifras.html","./cifras.json","./estudos-banda.js","./estudos-culto.js","./estudos-data.json","./estudos-ouvido.js","./estudos-plano.js","./estudos-timbres.js","./estudos.css","./estudos.html","./estudos.js","./graus.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon.png","./icons/icon.svg","./icons/icon.svg.png","./index.html","./manifest.json","./metronomo.js","./versao.js"];

self.addEventListener('install', event => {
  event.waitUntil(
    /* cache:'reload' passa por cima do cache HTTP do navegador: o GitHub Pages
       manda guardar por 10 min, e sem isto a versão nova era montada com os
       arquivos da anterior. */
    caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  let pedido = event.request;
  if (url.pathname === '/' || url.pathname === '/cifras') pedido = new Request(url.origin + '/cifras.html', {headers: event.request.headers});
  else if (url.pathname === '/estudos') pedido = new Request(url.origin + '/estudos.html', {headers: event.request.headers});

  event.respondWith(
    caches.match(pedido).then(cached => {
      const network = fetch(pedido, {cache: 'no-cache'}).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(pedido, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
