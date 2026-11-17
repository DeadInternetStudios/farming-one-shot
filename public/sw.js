// Lets Lantern Hollow start with no connection once it has been played online.
// Built files carry a hash in their name and never change, so they come from the cache first.
// Everything else asks the network first, so an update is never half old and half new,
// and falls back to the cache when the network is gone.
const CACHE = 'lantern-hollow-1';
const HASHED = /\/assets\/[^/]+-[\w-]{8}\.(?:js|css)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page lists what it has already loaded, because those requests went past a worker that was not running yet.
self.addEventListener('message', (event) => {
  const urls = event.data && event.data.remember;
  if (!Array.isArray(urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)))),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range')) return;
  event.respondWith(HASHED.test(url.pathname) ? cacheFirst(event) : networkFirst(event));
});

function remember(event, res) {
  if (res.status === 200) {
    const copy = res.clone();
    event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
  }
  return res;
}

// Static files here never differ by who asks, and some hosts send "Vary: Origin" that would make a module script miss its own cache entry.
const LOOSE = { ignoreVary: true };

async function cacheFirst(event) {
  const hit = await caches.match(event.request, LOOSE);
  return hit || remember(event, await fetch(event.request));
}

async function networkFirst(event) {
  try {
    return remember(event, await fetch(event.request));
  } catch (err) {
    const hit = (await caches.match(event.request, { ...LOOSE, ignoreSearch: true })) ||
      (event.request.mode === 'navigate' ? await caches.match('./', { ...LOOSE, ignoreSearch: true }) : undefined);
    if (hit) return hit;
    throw err;
  }
}
