const CACHE_VERSION = 'mapview-v15';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_FONTS = `${CACHE_VERSION}-fonts`;
const CACHE_API = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

async function precache() {
  const cache = await caches.open(CACHE_STATIC);

  await Promise.all(STATIC_ASSETS.map(async asset => {
    try {
      const res = await fetch(asset, { cache: 'no-store' });
      if (res.ok) await cache.put(asset, res);
    } catch {}
  }));

  // El HTML se guarda siempre sin caché HTTP para que un despliegue nuevo
  // no quede apuntando a chunks/CSS que ya fueron reemplazados.
  const htmlRes = await fetch('./index.html', { cache: 'no-store' });
  if (!htmlRes.ok) throw new Error('No se pudo precachear index.html');

  const html = await htmlRes.clone().text();
  await cache.put('./index.html', htmlRes.clone());
  await cache.put('./', htmlRes.clone());

  let assets = [];
  try {
    const manifestRes = await fetch('./asset-manifest.json', { cache: 'no-store' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      assets = (manifest.assets || []).map(url => new URL(url, self.location.origin).href);
    }
  } catch {}

  // Respaldo: si el manifest no está disponible, usa los assets del HTML.
  if (!assets.length) {
    assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map(m => m[1])
      .filter(url => url.includes('/_next/'))
      .map(url => new URL(url, self.location.origin).href);
  }

  await Promise.all([...new Set(assets)].map(async url => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) await cache.put(url, res);
    } catch {}
  }));
}

self.addEventListener('install', e => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // API de Google Sheets -> red primero, cache como respaldo
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok && request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_API).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Fuentes -> cache primero
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_FONTS).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navegación -> red primero y sin caché HTTP, para recibir el HTML del
  // despliegue actual; si no hay red, se usa la copia precacheada.
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Assets (chunks de Next, imágenes, etc.) -> cache primero
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok && request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(request, clone));
        }
        return res;
      });
    }).catch(() => caches.match(request))
  );
});
