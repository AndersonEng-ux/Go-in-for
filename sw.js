/* Go In For service worker: cache the whole app on install, serve from cache, refresh in the background. */
const VERSION = 'goinfor-v2';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './engine.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/apple-touch-icon.png',
  './fonts/Barlow-400.woff2', './fonts/Barlow-500.woff2', './fonts/Barlow-600.woff2', './fonts/Barlow-700.woff2',
  './fonts/BarlowCondensed-600.woff2', './fonts/BarlowCondensed-700.woff2', './fonts/BarlowCondensed-800.woff2',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('goinfor-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    // Every navigation inside the scope serves the app shell itself, never the response of some other in-scope URL.
    const nav = req.mode === 'navigate';
    const key = nav ? './index.html' : req;
    const cached = await cache.match(key);
    // Fonts and icons only change with a VERSION bump, so never refetch them; shell files refresh in the background.
    const immutable = /\/(fonts|icons)\//.test(req.url);
    if (cached && immutable) return cached;
    const network = fetch(nav ? new Request('./index.html') : req).then((res) => { if (res && res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
