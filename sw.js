/* sw.js — cache inteligente para páginas, CSS/JS e API de produtos */
const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const STATIC_ASSETS = [
  '/', '/index.html', '/tudo.html', '/celulares.html', '/perfumes.html',
  '/assets/css/theme.css',
  '/assets/logo-monogram-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (![STATIC_CACHE, RUNTIME_CACHE].includes(k)) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

const isApi = (url) => /script\.google\.com\/macros\/s\/.*\/exec/.test(url);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Estratégia para API: Stale-While-Revalidate
  if (isApi(url.href)) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(async cache => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then(networkRes => {
          if (networkRes.ok) cache.put(req, networkRes.clone());
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Páginas e assets estáticos: Network-First com fallback ao cache
  if (req.method === 'GET' && (url.origin === location.origin)) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
  }
});
