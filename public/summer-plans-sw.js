self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'Summer Plans'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon',
    badge: payload.badge || '/icon',
    tag: payload.tag || undefined,
    data: payload.data || { href: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(href)
          return client.focus()
        }
      }

      return self.clients.openWindow(href)
    }),
  )
})
