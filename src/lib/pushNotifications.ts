// src/lib/pushNotifications.ts
// Logique pure liée aux notifications push, extraite de src/sw.ts pour être
// testable sans importer le service worker lui-même (qui a des effets de
// bord au chargement : precacheAndRoute(self.__WB_MANIFEST), écouteurs
// d'événements push/notificationclick).

// Route de destination au clic sur une notification. Le service worker ne
// connaît pas le rôle (patient/praticien/secrétariat) du destinataire, donc
// on ne peut pas deviner un dashboard précis sans risquer d'envoyer
// quelqu'un vers une route bloquée par son rôle (ProtectedRoute). Seule
// /messages est sûre pour tout le monde (aucune restriction de rôle) ; le
// reste retombe sur l'accueil, d'où l'utilisateur navigue normalement.
// Pour un nouveau message, `related_id` porte l'id de l'expéditeur (voir
// notify_new_message, migration 016) — passé en query param pour que
// MessagesPage ouvre directement la bonne conversation plutôt que de
// retomber sur la plus récente, qui n'est pas toujours celle notifiée
// (plusieurs conversations avec des messages non lus en même temps).
export function urlForNotificationType(type?: string, relatedId?: string): string {
  if (type !== 'new_message') return '/'
  return relatedId ? `/messages?with=${relatedId}` : '/messages'
}

// Conversion standard d'une clé VAPID publique (base64url) vers le format
// Uint8Array attendu par PushManager.subscribe({ applicationServerKey }).
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
