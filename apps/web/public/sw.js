/* NimbusWatch service worker: Web Push display + click-through. No offline caching in MVP. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'NimbusWatch';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/alerts' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let url = (event.notification.data && event.notification.data.url) || '/alerts';
  // Only ever open pages on this site, whatever the payload says.
  try {
    const target = new URL(url, self.location.origin);
    url = target.origin === self.location.origin ? target.href : '/alerts';
  } catch {
    url = '/alerts';
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
