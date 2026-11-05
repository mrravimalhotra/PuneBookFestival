/**
 * Service worker source (plain JS, served by app/sw.js/route.ts).
 *
 * Strategy
 *  - Precache: app shell pages (/, /saved-pass, /offline, /my-pass, /checkin), icons, manifest.
 *  - /_next/static/*: cache-first (content-hashed, immutable).
 *  - Images (/_next/image, Supabase public storage): stale-while-revalidate.
 *  - Festival settings & winners pages (/, /winners, /privacy, /organisers): stale-while-revalidate.
 *  - Other navigations: network-first; offline fallback to cache, then /offline.
 *    /pass/* offline falls back to /saved-pass (the device's own pass).
 *  - Never cached: /admin, /api, report downloads, RSC payloads, other people's data.
 *  - Staff scanner: offline scans are queued in IndexedDB by the page and also
 *    replayed here on Background Sync ('pbf-checkins').
 */
export function serviceWorkerSource(version: string): string {
  return `/* Pune Book Festival service worker — ${version} */
const VERSION = ${JSON.stringify(version)};
const SHELL = 'pbf-shell-' + VERSION;
const PAGES = 'pbf-pages-' + VERSION;
const STATIC = 'pbf-static-v1';
const IMAGES = 'pbf-images-v1';
const KEEP = [SHELL, PAGES, STATIC, IMAGES];
const PRECACHE = ['/', '/saved-pass', '/offline', '/my-pass', '/checkin', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
const SWR_PAGES = ['/', '/winners', '/privacy', '/organisers'];
const NEVER = [/^\\/admin(\\/|$)/, /^\\/api(\\/|$)/, /^\\/staff\\/login/];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
        if (res.ok) await cache.put(url, res);
      } catch (e) { /* tolerate a missing page */ }
    }));
    // First install: activate at once. Updates wait for the user (update banner).
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('pbf-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isRsc(request) {
  const url = new URL(request.url);
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc') || request.headers.get('Next-Router-Prefetch');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: false });
  const network = fetch(request).then((res) => {
    if (res.ok && res.type !== 'opaqueredirect') cache.put(request, res.clone());
    return res;
  }).catch(() => undefined);
  if (hit) { event.waitUntil(network); return hit; }
  const res = await network;
  return res || offlineFallback(request);
}

async function offlineFallback(request) {
  const url = new URL(request.url);
  const shell = await caches.open(SHELL);
  if (url.pathname.startsWith('/pass/')) {
    const saved = await shell.match('/saved-pass');
    if (saved) return saved;
  }
  const pages = await caches.open(PAGES);
  const cached = (await pages.match(request)) || (await shell.match(url.pathname));
  if (cached) return cached;
  return (await shell.match('/offline')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
}

async function networkFirst(request, cacheable) {
  try {
    const res = await fetch(request);
    if (cacheable && res.ok && res.type === 'basic') {
      const cache = await caches.open(PAGES);
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    return offlineFallback(request);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Public logos/photos from Supabase Storage.
  if (url.origin !== self.location.origin) {
    if (url.pathname.includes('/storage/v1/object/public/')) {
      event.respondWith(staleWhileRevalidate(request, IMAGES, event));
    }
    return;
  }

  if (NEVER.some((re) => re.test(url.pathname))) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(staleWhileRevalidate(request, IMAGES, event));
    return;
  }
  if (isRsc(request)) return;

  if (request.mode === 'navigate') {
    if (SWR_PAGES.includes(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, PAGES, event));
      return;
    }
    // Personal pages (/pass/*) are never stored; the device's own pass lives in IndexedDB.
    const cacheable = !url.pathname.startsWith('/pass/') && !url.pathname.startsWith('/checkin');
    event.respondWith(networkFirst(request, cacheable));
  }
});

// ---- Staff scanner: Background Sync replay of queued check-ins ----------------
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pbf-scanner', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'clientRef' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbAll(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('queue').objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function idbDelete(db, keys) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    keys.forEach((k) => tx.objectStore('queue').delete(k));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replayCheckins() {
  const db = await idbOpen();
  const items = await idbAll(db);
  if (items.length === 0) return;
  const res = await fetch('/api/staff/checkins', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: items.slice(0, 200) }),
  });
  if (!res.ok) throw new Error('sync failed: ' + res.status);
  const body = await res.json();
  const done = (body.results || []).filter((r) => r.final).map((r) => r.clientRef);
  await idbDelete(db, done);
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'CHECKINS_SYNCED', count: done.length }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'pbf-checkins') event.waitUntil(replayCheckins());
});
`;
}
