// src/components/ui/UpdateBanner.tsx
// Bandeau "Nouvelle version disponible" : le service worker (src/sw.ts,
// skipWaiting + clientsClaim) prend la main dès qu'une nouvelle version est
// téléchargée, mais la page déjà ouverte continue d'exécuter l'ANCIEN code
// jusqu'au prochain rechargement — l'application installée pouvait ainsi
// rester des jours sur une vieille version (repéré le 05/10/2026 : export
// comptable et double authentification "invisibles" après déploiement).
//
// Détection : l'événement 'controllerchange' ne signale une MISE À JOUR que si
// la page avait déjà un service worker au chargement ; sans ce contrôle, la
// toute première installation (prise de contrôle initiale) afficherait le
// bandeau à tort. On redemande aussi une vérification de mise à jour au retour
// sur l'onglet/l'application, sinon le navigateur ne la fait qu'à la
// navigation ou environ toutes les 24h.
import { useEffect, useState } from 'react'

export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker
    const hadController = !!sw.controller

    function onControllerChange() {
      if (hadController) setUpdateReady(true)
    }
    sw.addEventListener('controllerchange', onControllerChange)

    function checkForUpdate() {
      if (document.visibilityState !== 'visible') return
      sw.getRegistration().then(reg => reg?.update()).catch(() => {})
    }
    document.addEventListener('visibilitychange', checkForUpdate)

    return () => {
      sw.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', checkForUpdate)
    }
  }, [])

  if (!updateReady) return null

  return (
    <div role="status"
      className="fixed left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-80 z-[90] bg-white border border-sage-200 shadow-xl rounded-2xl px-4 py-3 flex items-center gap-3">
      <p className="text-sm text-gray-700 flex-1">Une nouvelle version d'Animéaux est disponible.</p>
      <button onClick={() => window.location.reload()} className="btn-primary text-sm px-4 py-2 whitespace-nowrap">
        Recharger
      </button>
    </div>
  )
}
