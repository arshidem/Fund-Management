self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } catch (err) { console.error(err); }
  }

  const title = data.title || 'New Notification';
  const options = {
    body: data.message || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    data: { url: data.data?.clickAction || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const clickAction = event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === clickAction && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(clickAction);
    })
  );
});
