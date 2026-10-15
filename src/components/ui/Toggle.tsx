// src/components/ui/Toggle.tsx
// Interrupteur avec son titre et une phrase d'explication (profil du praticien). Accessible :
// un vrai bouton `role="switch"` relié à son titre. Il ne fait que changer une valeur du
// formulaire : l'enregistrement se fait avec le bouton en bas de la page.
import { useId } from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: React.ReactNode
  disabled?: boolean
}

export default function Toggle({ checked, onChange, label, description, disabled }: Props) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 py-3 border-t border-sand-100 first:border-t-0 first:pt-0">
      <div className="flex-1 min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium text-gray-900">{label}</p>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`}
        disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 disabled:opacity-50 ${
          checked ? 'bg-sage-500' : 'bg-gray-300'
        }`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  )
}
