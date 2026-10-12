// src/components/ui/ReportButton.tsx
// Signalement à l'équipe Animéaux, traité ensuite depuis l'admin (vue
// « Signalements »). Deux usages, avec des auteurs différents (règle imposée
// côté base par create_report, migration 130) :
//   - targetType « doctor » : un utilisateur connecté signale un praticien
//     (fiche publique) ;
//   - targetType « review » : SEUL le praticien concerné signale un avis
//     abusif, depuis l'onglet Avis de son espace.
import { useState } from 'react'
import { useCreateReport } from '@/hooks/useData'

interface Props {
  targetType: 'review' | 'doctor'
  targetId: string
  label: string
  placeholder?: string
}

export default function ReportButton({ targetType, targetId, label, placeholder = 'Expliquez brièvement le problème...' }: Props) {
  const createReport = useCreateReport()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!reason.trim()) return
    setError('')
    try {
      await createReport.mutateAsync({ targetType, targetId, reason: reason.trim() })
      setOpen(false)
      setReason('')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch (e: any) {
      setError(e.message ?? "Le signalement n'a pas pu être envoyé.")
    }
  }

  if (sent) return <p className="text-xs text-green-600">✓ Signalement envoyé, merci.</p>

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
      🚩 {label}
    </button>
  )

  return (
    <div className="text-left bg-gray-50 rounded-xl p-3 mt-1">
      <textarea value={reason} onChange={e => setReason(e.target.value)}
        className="input text-xs resize-none" rows={2}
        placeholder={placeholder} autoFocus />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={submit} disabled={createReport.isPending || !reason.trim()}
          className="btn-primary text-xs px-3 py-1.5">
          {createReport.isPending ? 'Envoi...' : 'Envoyer le signalement'}
        </button>
        <button onClick={() => { setOpen(false); setReason(''); setError('') }} className="btn-secondary text-xs px-3 py-1.5">
          Annuler
        </button>
      </div>
    </div>
  )
}
