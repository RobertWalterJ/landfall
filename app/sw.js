// Landfall — service worker.
//
// TWO RULES THAT MATTER ON THIS ORIGIN.
//
// 1. All of these apps are served from the same GitHub Pages origin, so the
//    CacheStorage is SHARED. This worker must never call the global
//    caches.match(), and must never delete a cache just because it is not one
//    of ours — the naive "delete everything that isn't my version" activate
//    handler would wipe the offline cache of Halyard and Wordhoard.
//
// 2. Maps are fetched lazily and there are 43 of them. The shell is precached;
//    map and flag payloads are cached the first time they are actually used.

// Replaced per deploy by make-deploy.mjs. A fixed cache name means a device
// that has the old shell can keep serving it; a new name guarantees the new
// build installs cleanly beside the old one and the old one is then dropped.
const VERSION = 'landfall-v1-dev';
const SHELL = VERSION + '-shell';
const LAZY = VERSION + '-lazy';
const OURS = [SHELL, LAZY];

const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'regions.css',
  'data/regions.json',
  'manifest.webmanifest',
  'js/app.js',
  'js/data.js',
  'js/engine.js',
  'js/schedule.js',
  'js/map.js',
  'js/speech.js',
  'js/sound.js',
  'js/hero.js',
  'js/sweep.js',
  'fonts/fonts.css',
  'fonts/literata-latin-400.woff2',
  'fonts/literata-latin-ext-400.woff2',
  'fonts/archivo-latin-400.woff2',
  'fonts/archivo-latin-ext-400.woff2',
  'data/core.json',
  'data/maps/caribbean.json',
  'data/maps/world.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // One at a time: a single 404 in addAll rejects the whole install and the
    // app silently never goes offline.
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('landfall-') && !OURS.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;

  const isData = /\/data\/(maps|flags)/.test(url.pathname);

  e.respondWith((async () => {
    const cacheName = isData ? LAZY : SHELL;
    const cache = await caches.open(cacheName);

    if (isData) {
      // Cache-first: a map never changes within a version, and this is what
      // makes an aeroplane-mode session work.
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }

    // Network-first for the shell, so a deploy reaches the phone on next open.
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const index = await cache.match('index.html');
        if (index) return index;
      }
      throw new Error('offline and not cached');
    }
  })());
});
