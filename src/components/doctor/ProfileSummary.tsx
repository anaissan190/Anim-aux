// src/components/doctor/ProfileSummary.tsx
// En-tête de synthèse de l'onglet Profil du praticien : photo, nom, pastilles d'état (métier,
// vérification, offre, visibilité) et jauge « Profil complété ». Purement informatif : tout se
// modifie dans les sous-onglets en dessous.
import type { ProfileCompleteness } from '@/lib/profileCompleteness'

interface Props {
  name: string
  avatarUrl?: string | null
  specialties: string[]
  verification?: 'verified' | 'pending' | 'rejected' | null
  planLabel: string
  // undefined = pas encore chargé : on n'affiche rien plutôt que de se tromper
  listed?: boolean
  completeness: ProfileCompleteness
}

const VERIFICATION_CHIP: Record<'verified' | 'pending' | 'rejected', { label: string; cls: string }> = {
  verified: { label: '✓ Vérifié', cls: 'bg-moss-50 text-moss-800' },
  pending: { label: 'Vérification en attente', cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Profil rejeté', cls: 'bg-red-100 text-red-700' },
}

export default function ProfileSummary({ name, avatarUrl, specialties, verification, planLabel, listed, completeness }: Props) {
  const chip = 'text-xs px-2.5 py-0.5 rounded-full'
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-xl overflow-hidden flex-shrink-0 text-sage-700 font-bold">
          {avatarUrl
            ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
            : (name.trim()[0]?.toUpperCase() ?? '👤')}
        </div>
        <div className="flex-1 min-w-[180px]">
          <p className="font-bold text-gray-900 text-lg leading-tight">{name || 'Mon profil'}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {specialties.map(s => <span key={s} className={`${chip} bg-sand-100 text-gray-600`}>{s}</span>)}
            {verification && <span className={`${chip} ${VERIFICATION_CHIP[verification].cls}`}>{VERIFICATION_CHIP[verification].label}</span>}
            {planLabel && <span className={`${chip} bg-sage-50 text-sage-800`}>{planLabel}</span>}
            {listed === true && <span className={`${chip} bg-moss-50 text-moss-800`}>Visible dans la recherche</span>}
            {listed === false && <span className={`${chip} bg-amber-100 text-amber-700`}>Masqué de la recherche</span>}
          </div>
        </div>
        <div className="min-w-[170px]">
          <p className="text-xs text-gray-500 mb-1">Profil complété à {completeness.percent} %</p>
          <div className="h-1.5 rounded-full bg-sand-100 overflow-hidden" role="progressbar"
            aria-valuenow={completeness.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profil complété">
            <div className="h-full bg-sage-500 rounded-full transition-all" style={{ width: `${completeness.percent}%` }} />
          </div>
          {completeness.hint && <p className="text-xs text-gray-400 mt-1">{completeness.hint}</p>}
        </div>
      </div>
    </div>
  )
}
