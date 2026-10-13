// src/components/doctor/UpgradePanel.tsx
// Invitation à passer à l'abonnement, pour un praticien en offre gratuite.
//   variant="banner" : bandeau orange en haut de « Mon espace » ;
//   variant="page"   : page affichée à la place d'un onglet verrouillé.
// Le bouton ouvre un email pré-rempli vers l'équipe tant que le paiement en ligne
// n'est pas branché (voir upgradeMailto dans src/lib/doctorPlan.ts).
import { Link } from 'react-router-dom'
import { upgradeMailto } from '@/lib/doctorPlan'

interface Props {
  title: string
  body: string
  doctorName?: string | null
  variant?: 'banner' | 'page'
}

export default function UpgradePanel({ title, body, doctorName, variant = 'banner' }: Props) {
  const href = upgradeMailto(doctorName)

  if (variant === 'page') {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-sm border border-sand-200 text-center animate-rise-in">
        <div className="text-4xl mb-3" aria-hidden="true">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-1">{body}</p>
        <p className="text-xs text-gray-400 mb-6">Cette fonctionnalité fait partie de l&apos;abonnement.</p>
        <a href={href} className="btn-primary inline-block">Passer à l&apos;abonnement</a>
        <div className="mt-4">
          <Link to="/dashboard/doctor?tab=home" className="text-sm text-gray-400 hover:text-sage-600 transition-colors">
            ← Retour à Mon espace
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl p-5 sm:p-6 mb-6 bg-sage-600 text-white flex flex-wrap items-center gap-4">
      <div className="text-4xl" aria-hidden="true">📅</div>
      <div className="flex-1 min-w-[220px]">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm mt-1 opacity-95 leading-relaxed">{body}</p>
      </div>
      <a href={href}
        className="bg-white text-sage-700 font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-sage-50 transition-colors whitespace-nowrap">
        Passer à l&apos;abonnement
      </a>
    </div>
  )
}
