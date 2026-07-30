/// <reference lib="webworker" />
// src/sw.ts — service worker custom (mode injectManifest de vite-plugin-pwa).
// Le mode par défaut (generateSW) génère automatiquement le service worker
// depuis Workbox mais ne permet pas d'y ajouter des gestionnaires
// d'événements custom (push, notificationclick) : on écrit donc ce fichier
// nous-mêmes, en gardant le précaching de l'app shell (offline minimal, déjà
// en place) via precacheAndRoute.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { urlForNotificationType } from '@/lib/pushNotifications'

declare let self: ServiceWorkerGlobalScope

// registerType: 'autoUpdate' (vite.config.ts) veut dire qu'on ne demande
// jamais confirmation à l'utilisateur avant de mettre à jour — indispensable
// ici : sans self.skipWaiting()/clientsClaim(), un ancien service worker
// continue de servir un index.html qui référence des chunks JS déjà
// supprimés du serveur au déploiement suivant (les noms de fichiers changent
// à chaque build), ce qui fait planter l'app pour un visiteur déjà venu une
// fois. cleanupOutdatedCaches() supprime aussi le précache de l'ancienne
// version une fois la nouvelle activée.
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title: string
  body: string
  type?: string
  related_id?: string
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json()
  } catch {
    return
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { type: payload.type, related_id: payload.related_id },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = urlForNotificationType(event.notification.data?.type)
  event.waitUntil(self.clients.openWindow(url))
})
