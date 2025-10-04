self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated');
  return self.clients.claim();
});

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let data = { title: 'New Notification', body: 'You have a new notification', url: '/' };
  
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: data.url },
    tag: 'notification-' + Date.now(),
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
