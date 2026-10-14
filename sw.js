// Service Worker: holt die App immer frisch aus dem Netz (damit Updates sofort
// ankommen) und fällt nur ohne Netz auf die gespeicherte Kopie zurück.
const CACHE = 'lebensdashboard-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sync.js',
  './push.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Push-Erinnerungen (verschickt von der Supabase-Funktion "send-reminders")
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Lebens-Dashboard', {
    body: d.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag,
    data: { url: d.url || './' },
  }));
});

// Tippen auf die Nachricht öffnet die App (oder holt sie nach vorn).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) if ('focus' in w) return w.focus();
    return self.clients.openWindow(event.notification.data?.url || './');
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // immer direkt ans Netz

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? './index.html' : url.pathname;
    let res = null;
    try {
      res = await Promise.race([
        fetch(req.url, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
      ]);
      if (res.ok) {
        cache.put(key, res.clone());
        return res;
      }
    } catch {
      // offline oder zu langsam → gespeicherte Kopie
    }
    // Auch bei Fehlerseiten des Servers (z. B. Wartung) lieber die gespeicherte Version zeigen.
    const cached = await cache.match(key, { ignoreSearch: true });
    return cached || res || Response.error();
  })());
});
