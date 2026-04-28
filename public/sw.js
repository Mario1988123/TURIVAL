// Service worker para Web Push de Turiaval
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Turiaval', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Turiaval'
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'turiaval',
    data: { url: data.url || '/fichajes' },
    requireInteraction: data.requireInteraction || false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/fichajes'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.focus(); w.navigate(targetUrl); return }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    }),
  )
})
