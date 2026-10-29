// src/components/doctor/UpgradePanel.tsx
// Invitation à passer à l'abonnement, pour un praticien en offre gratuite.
//   variant="banner" : bandeau orange en haut de « Mon espace » ;
//   variant="page"   : page affichée à la place d'un onglet verrouillé.
// Le bouton ouvre l'écran de tarification (/abonnement), d'où part le paiement.
// Dans l'application native : aucune invitation ni bouton d'achat (règles des stores, voir
// canSellSubscriptions) — la page verrouillée dit seulement que la fonction n'est pas disponible.
import { Link } from 'react-router-dom'
import { canSellSubscriptions } from '@/lib/nativeApp'

interface Props {
  title: string
  body: string
  variant?: 'banner' | 'page'
}

export default function UpgradePanel({ title, body, variant = 'banner' }: Props) {
  const canSell = canSellSubscriptions()

  if (variant === 'page') {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-sm border border-sand-200 text-center animate-rise-in">
        <div className="text-4xl mb-3" aria-hidden="true">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        {canSell ? (
          <>
            <p className="text-sm text-gray-600 leading-relaxed mb-1">{body}</p>
            <p className="text-xs text-gray-400 mb-6">Cette fonctionnalité fait partie de l&apos;abonnement.</p>
            <Link to="/abonnement" className="btn-primary inline-block">Passer à l&apos;abonnement</Link>
          </>
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed mb-6">Cette fonctionnalité n&apos;est pas disponible avec votre offre actuelle.</p>
        )}
        <div className="mt-4">
          <Link to="/dashboard/doctor?tab=home" className="text-sm text-gray-400 hover:text-sage-600 transition-colors">
            ← Retour à Mon espace
          </Link>
        </div>
      </div>
    )
  }

  if (!canSell) return null

  return (
    <div className="rounded-3xl p-5 sm:p-6 mb-6 bg-sage-600 text-white flex flex-wrap items-center gap-4">
      <div className="text-4xl" aria-hidden="true">📅</div>
      <div className="flex-1 min-w-[220px]">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm mt-1 opacity-95 leading-relaxed">{body}</p>
      </div>
      <Link to="/abonnement"
        className="bg-white text-sage-700 font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-sage-50 transition-colors whitespace-nowrap">
        Passer à l&apos;abonnement
      </Link>
    </div>
  )
}
