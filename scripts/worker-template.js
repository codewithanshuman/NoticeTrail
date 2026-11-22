const name = 'noticetrail-shell-__VERSION__';
const files = /* FILES */ [];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(name).then(cache => cache.addAll(files.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('noticetrail-shell-') && key !== name) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = event.request.mode === 'navigate' ? '/index.html' : url.pathname;
  if (!files.includes(path)) return;
  event.respondWith(caches.open(name).then(async cache => (await cache.match(path)) || fetch(event.request)));
});
