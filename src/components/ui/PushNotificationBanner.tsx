// src/components/ui/PushNotificationBanner.tsx
// Invite proactive à activer les notifications push — le réglage existe
// déjà (onglet Profil / Mon espace), mais personne n'y va jamais de
// lui-même : ce canal ne touche donc probablement personne aujourd'hui.
// Se cache dès que l'utilisateur est abonné, a refusé la permission
// navigateur, ou a cliqué "Plus tard" (mémorisé en local, pas de relance
// à chaque visite).
import { useState } from 'react'
import { usePushSubscriptionStatus, useEnablePushNotifications } from '@/hooks/useData'

const DISMISS_KEY = 'push-banner-dismissed'

export default function PushNotificationBanner() {
  const { data: pushStatus } = usePushSubscriptionStatus()
  const enablePush = useEnablePushNotifications()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [error, setError] = useState('')

  if (!pushStatus?.supported || pushStatus.subscribed || dismissed) return null
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function handleEnable() {
    setError('')
    try {
      await enablePush.mutateAsync()
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'activation des notifications.")
    }
  }

  return (
    <div className="rounded-2xl p-4 mb-6 bg-sage-50 border border-sage-100 text-sm flex items-start gap-3">
      <span className="text-lg">🔔</span>
      <div className="flex-1">
        <p className="font-medium text-gray-900">Active les notifications</p>
        <p className="text-gray-600 mt-0.5">
          Reçois une alerte dès qu'un rendez-vous est confirmé, annulé, ou qu'un message arrive — même quand l'appli est fermée.
        </p>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        <div className="flex gap-2 mt-2">
          <button onClick={handleEnable} disabled={enablePush.isPending} className="btn-primary text-xs px-3 py-1.5">
            {enablePush.isPending ? 'Activation...' : 'Activer'}
          </button>
          <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
