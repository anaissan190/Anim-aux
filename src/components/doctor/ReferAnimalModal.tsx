// src/components/doctor/ReferAnimalModal.tsx
// Modale "Envoyer à un confrère" — recherche un praticien par nom ou
// métier (réutilise useDoctors, comme SearchPage.tsx) et crée une demande
// de partage soumise à l'accord du propriétaire (voir migration 105).
import { useState } from 'react'
import { useDoctors, useCreateAnimalReferral } from '@/hooks/useData'
import { showToast } from '@/lib/toast'

export default function ReferAnimalModal({
  animalId, referringDoctorId, onClose,
}: {
  animalId: string
  referringDoctorId: string
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState<{ id: string; name: string } | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const { data: results = [], isLoading } = useDoctors({ specialty: search }, search.trim().length >= 2)
  const createReferral = useCreateAnimalReferral()

  async function handleSend() {
    if (!selectedDoctor) return
    setError('')
    try {
      await createReferral.mutateAsync({
        animal_id: animalId,
        referring_doctor_id: referringDoctorId,
        target_doctor_id: selectedDoctor.id,
        reason: reason.trim() || undefined,
      })
      showToast('✓ Demande envoyée, en attente de l\'accord du propriétaire.')
      onClose()
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'envoi de la demande.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative card p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-1">Envoyer à un confrère</h3>
        <p className="text-xs text-gray-500 mb-4">
          Le propriétaire devra accepter avant que ce praticien n'ait accès au dossier.
        </p>

        {!selectedDoctor ? (
          <>
            <input className="input text-sm" placeholder="Nom ou métier du praticien..."
              value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
              {isLoading && <p className="text-xs text-gray-400 text-center py-3">Recherche...</p>}
              {!isLoading && search.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">Aucun praticien trouvé.</p>
              )}
              {results.filter((d: any) => d.id !== referringDoctorId).map((d: any) => {
                const name = d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : 'Praticien'
                return (
                  <button key={d.id} type="button"
                    onClick={() => setSelectedDoctor({ id: d.id, name })}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 hover:bg-sage-50 text-left transition-colors">
                    <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-bold text-sm overflow-hidden flex-shrink-0">
                      {d.profiles?.avatar_url
                        ? <img src={d.profiles.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" />
                        : name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500 truncate">{d.specialties?.join(' · ')}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border-2 border-sage-200 bg-sage-50 mb-3">
              <p className="text-sm font-medium text-sage-700">{selectedDoctor.name}</p>
              <button onClick={() => setSelectedDoctor(null)} className="text-xs text-gray-400 hover:underline">Changer</button>
            </div>
            <label className="text-xs text-gray-500">Contexte pour le propriétaire (optionnel)</label>
            <textarea className="input text-sm mt-1" rows={3} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: je vous conseille de consulter un comportementaliste pour..." />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleSend} disabled={createReferral.isPending} className="btn-primary text-sm">
                {createReferral.isPending ? 'Envoi...' : 'Envoyer la demande'}
              </button>
              <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            </div>
          </>
        )}

        {!selectedDoctor && (
          <button onClick={onClose} className="mt-4 text-xs text-gray-400 hover:underline">Annuler</button>
        )}
      </div>
    </div>
  )
}
