// src/components/ui/IntendedPlanPicker.tsx
// Choix de la formule souhaitée pendant le pré-lancement : une intention, jamais un achat.
import { PLAN_OFFERS } from '@/lib/subscription'
import type { IntendedPlan } from '@/lib/prelaunch'

const CHOICES: IntendedPlan[] = ['free', 'pro', 'cabinet']

export default function IntendedPlanPicker({ value, onChange, error }: {
  value: IntendedPlan | null
  onChange: (plan: IntendedPlan) => void
  error?: string
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-1">Quelle formule vous intéresse ?</legend>
      <p className="text-xs text-gray-500 mb-2">
        Ce n&apos;est pas un achat : aucun paiement aujourd&apos;hui. Vous confirmerez à l&apos;ouverture et pourrez en changer.
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Formule souhaitée">
        {CHOICES.map(id => {
          const offer = PLAN_OFFERS[id]
          const selected = value === id
          return (
            <label key={id}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors
                ${selected ? 'border-sage-500 bg-sage-50' : 'border-sand-200 bg-white hover:border-sage-200'}`}>
              <input type="radio" name="intended_plan" value={id} checked={selected} onChange={() => onChange(id)}
                className="mt-1 h-4 w-4 text-sage-600 focus:ring-sage-500" />
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{offer.name}</span>
                  <span className="text-sm font-semibold text-sage-600 whitespace-nowrap">
                    {offer.priceHt ? `${offer.priceHt} € / mois` : '0 €'}
                  </span>
                </span>
                <span className="block text-xs text-gray-500">{offer.tagline}</span>
              </span>
            </label>
          )
        })}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </fieldset>
  )
}
