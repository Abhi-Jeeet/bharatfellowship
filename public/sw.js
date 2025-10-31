const CACHE = 'mgnrega-cache-v1';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Cache-first for our API to keep last-good copy
  if (url.pathname.startsWith('/api/mgnrega')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(event.request);
          if (fresh && fresh.ok) cache.put(event.request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw new Error('Offline and no cache');
        }
      })
    );
    return;
  }
  // Default: network falling back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});


