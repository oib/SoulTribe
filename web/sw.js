/* Service Worker for SoulTribe.chat
   - Basic install/activate lifecycle
   - Caches core shell (optional lightweight)
   - Handles 'message' events to show notifications even when page is in background
   - Handles 'push' events (future: server push via Web Push / VAPID)
*/

const CACHE_NAME = 'soultribe-shell-v1';
const CORE_URLS = [
  '/',
  '/index.html',
  '/theme.css',
  '/styles.css',
  '/mobile.css',
  '/css/navbar.css',
  '/css/components.css',
  '/img/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_URLS)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for HTML, cache-first for others (very light)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isHTML = req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
  } else {
    event.respondWith(
      caches.match(req).then((c) => c || fetch(req))
    );
  }
});

// Local message -> showNotification
self.addEventListener('message', async (event) => {
  const data = event.data || {};
  if (data && data.type === 'notify' && data.title) {
    try {
      await self.registration.showNotification(data.title, {
        body: data.body || '',
        icon: '/img/apple-touch-icon.png',
        badge: '/img/apple-touch-icon.png',
        tag: data.tag || undefined,
        data: data.data || {},
      });
    } catch (e) {
      // no-op
    }
  }
});

// Future: Web Push handler (requires subscription + server push)
self.addEventListener('push', (event) => {
  try {
    const payload = event.data ? event.data.json() : {};
    const title = payload.title || 'SoulTribe.chat';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/img/apple-touch-icon.png',
      badge: payload.badge || '/img/apple-touch-icon.png',
      data: payload.data || {},
      tag: payload.tag || undefined,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data ? event.data.text() : '';
    event.waitUntil(self.registration.showNotification('SoulTribe.chat', { body: text }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard.html';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          client.navigate(url);
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(url);
      }
    })()
  );
});
