// src/components/doctor/PrelaunchPlanBanner.tsx
// Pendant le pré-lancement, invite un praticien qui n'a pas encore indiqué la formule qui l'intéresse
// (compte créé avant la phase, par exemple) à le faire. Aucun paiement : simple intention, utile pour
// compter les praticiens et leurs besoins avant l'ouverture.
import { Link } from 'react-router-dom'
import { useLaunchSettings, useMyIntendedPlan } from '@/hooks/useData'
import { launchLabel } from '@/lib/prelaunch'
import { canSellSubscriptions } from '@/lib/nativeApp'

export default function PrelaunchPlanBanner() {
  const { data: launch } = useLaunchSettings()
  const { data: intendedPlan } = useMyIntendedPlan()
  // `undefined` = lecture en cours : on n'affiche rien plutôt que de clignoter.
  if (!canSellSubscriptions() || launch?.phase !== 'prelaunch' || intendedPlan !== null) return null
  return (
    <div className="rounded-2xl border border-sage-100 bg-sage-50 p-4 mb-6 flex flex-wrap items-center justify-between gap-3" data-testid="prelaunch-plan-banner">
      <div className="text-sm text-sage-800">
        <p className="font-semibold">{launchLabel(launch.publicLaunchDate)}</p>
        <p>Dites-nous quelle formule vous intéresse. Aucun paiement aujourd&apos;hui, vous pourrez la changer.</p>
      </div>
      <Link to="/abonnement" className="btn-primary text-sm whitespace-nowrap">Choisir ma formule</Link>
    </div>
  )
}
