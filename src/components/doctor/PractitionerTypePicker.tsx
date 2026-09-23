// src/components/doctor/PractitionerTypePicker.tsx
// Sélecteur à bascule (plusieurs métiers possibles, ex: éducateur canin ET
// naturopathe animalier) — remplace le pattern "un seul choix qui écrase le
// précédent" utilisé jusqu'au 23/09/2026 sur l'inscription, et les deux
// <select> natifs (mauvaise UX multi-select sur mobile) des deux pages de
// profil (ProfilPage.tsx / DoctorDashboard.tsx, qui ne partagent aucun code
// entre elles — d'où ce composant partagé plutôt que dupliqué une 3e fois).
import { PRACTITIONER_TYPES } from '@/lib/practitionerTypes'

export default function PractitionerTypePicker({
  selectedIds, onChange, otherText, onOtherTextChange, error,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  otherText: string
  onOtherTextChange: (text: string) => void
  error?: string
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Votre profession <span className="font-normal text-gray-400">(plusieurs choix possibles)</span>
      </label>
      <div className="grid grid-cols-1 gap-2">
        {PRACTITIONER_TYPES.map(type => (
          <button key={type.id} type="button"
            onClick={() => toggle(type.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors
              ${selectedIds.includes(type.id)
                ? 'border-sage-500 bg-sage-50 text-sage-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <span className="text-xl">{type.icon}</span>
            <span>{type.label}</span>
            {selectedIds.includes(type.id) && <span className="ml-auto text-sage-500">✓</span>}
          </button>
        ))}
      </div>
      {selectedIds.includes('autre') && (
        <div className="mt-2">
          <input value={otherText}
            onChange={e => onOtherTextChange(e.target.value)}
            className="input" placeholder="Précisez votre profession" />
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
