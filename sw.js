const CACHE_VERSION = 'mapview-v6';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_CDN = `${CACHE_VERSION}-cdn`;
const CACHE_FONTS = `${CACHE_VERSION}-fonts`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then(c => c.addAll(STATIC_ASSETS)),
      caches.open(CACHE_CDN).then(c =>
        Promise.all(CDN_ASSETS.map(url =>
          fetch(url).then(r => {
            if (r.ok) c.put(url, r);
          }).catch(() => {})
        ))
      ),
      caches.open(CACHE_FONTS).then(c =>
        fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap')
          .then(r => { if (r.ok) c.put('fonts-css', r); })
          .catch(() => {})
      )
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k =>
          k !== CACHE_STATIC && k !== CACHE_CDN && k !== CACHE_FONTS
        ).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls (Google Sheets) -> network first, cache fallback
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com/macros')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // CDN assets -> cache first, network fallback
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            const cacheName = url.hostname.includes('fonts') ? CACHE_FONTS : CACHE_CDN;
            caches.open(cacheName).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Static assets -> cache first, network fallback
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
    }).catch(() => {
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
