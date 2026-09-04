/// <reference lib="webworker" />
// src/sw.ts — service worker custom (mode injectManifest de vite-plugin-pwa).
// Le mode par défaut (generateSW) génère automatiquement le service worker
// depuis Workbox mais ne permet pas d'y ajouter des gestionnaires
// d'événements custom (push, notificationclick) : on écrit donc ce fichier
// nous-mêmes, en gardant le précaching de l'app shell (offline minimal, déjà
// en place) via precacheAndRoute.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { urlForNotificationType, urlBase64ToUint8Array } from '@/lib/pushNotifications'

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
  // Un payload JSON valide mais sans title/body (malformé côté envoyeur)
  // affichait une notification vide/étrange au lieu d'être ignoré proprement.
  if (!payload.title || !payload.body) return

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
  event.waitUntil(
    (async () => {
      // Réutilise un onglet déjà ouvert de l'appli plutôt que d'en ouvrir un
      // nouveau à chaque clic — sans ça, cliquer plusieurs notifications
      // accumule des onglets en double.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const origin = self.location.origin
      for (const client of clients) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          await (client as WindowClient).focus()
          if ('navigate' in client) await (client as WindowClient).navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })()
  )
})

// Le navigateur fait tourner les abonnements push (rotation de sécurité,
// expiration) et prévient via cet évènement plutôt que de laisser l'appli
// le découvrir elle-même — sans ce gestionnaire, l'endpoint stocké en base
// devient invalide en silence et les futurs push échouent pour toujours
// tant que l'utilisateur ne redésactive/réactive pas manuellement les
// notifications. Le service worker n'a pas accès à la session Supabase
// (stockage du thread principal) : on relaie donc le nouvel abonnement à un
// onglet ouvert, qui fait la mise à jour en base avec son propre contexte
// authentifié (voir le listener 'message' dans App.tsx).
self.addEventListener('pushsubscriptionchange', (event: any) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
        ?? urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY as string)
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        client.postMessage({ type: 'push-subscription-changed', subscription: subscription.toJSON() })
      }
    })()
  )
})
