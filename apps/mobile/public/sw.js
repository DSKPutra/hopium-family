/* hopium.family service worker: shows Web Push notifications and deep-links on click. */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'hopium.family', {
      body: data.body || '',
      icon: '/favicon.png',
      data: { href: data.href || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/';
  event.waitUntil(self.clients.openWindow(href));
});
