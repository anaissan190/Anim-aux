// src/pages/AnimalRecordExportPage.tsx
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import BackButton from '@/components/ui/BackButton'
import { useAnimal, useVaccines, useWeightTracking, useHealthRecords, useAnimalOwner } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'

// Vue imprimable/exportable du dossier de santé d'un animal — pensée pour
// être montrée à un nouveau praticien ou une clinique d'urgence sans accès
// à l'app. Pas de dépendance PDF ajoutée : window.print() + CSS d'impression
// suffisent, un navigateur peut « Enregistrer en PDF » nativement.
export default function AnimalRecordExportPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isDoctor = user?.role === 'doctor'
  const { data: animal, isLoading } = useAnimal(id!)
  const { data: vaccines = [] } = useVaccines(id!)
  const { data: weights = [] } = useWeightTracking(id!)
  const { data: records = [] } = useHealthRecords(id!)
  const { data: owner } = useAnimalOwner(isDoctor ? animal?.owner_id : undefined)

  if (isLoading || !animal) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Chargement...</div>
  }

  const emoji = SPECIES_EMOJI[animal.species] ?? '🐾'
  const ownerName = owner ? `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() : ''

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <BackButton fallback={`/animal/${id}`} />
        <button onClick={() => window.print()} className="btn-primary text-sm px-4 py-2">
          🖨️ Imprimer / Enregistrer en PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 print:px-0 print:py-0">
        <header className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
          <div>
            <p className="text-sm text-sage-600 font-medium">Carnet de santé — Animéaux</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{emoji} {animal.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {animal.species}{animal.breed ? ` — ${animal.breed}` : ''}{animal.gender ? ` — ${animal.gender}` : ''}
            </p>
          </div>
          <p className="text-xs text-gray-400 whitespace-nowrap">
            Généré le {format(new Date(), 'd MMMM yyyy', { locale: fr })}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-8">
          {animal.date_of_birth && (
            <p><span className="text-gray-400">Date de naissance : </span>{format(new Date(animal.date_of_birth), 'd MMMM yyyy', { locale: fr })}</p>
          )}
          {animal.weight_kg && <p><span className="text-gray-400">Dernier poids connu : </span>{animal.weight_kg} kg</p>}
          {animal.microchip_number && <p><span className="text-gray-400">Puce : </span>{animal.microchip_number}</p>}
          {animal.tattoo_number && <p><span className="text-gray-400">Tatouage : </span>{animal.tattoo_number}</p>}
          {ownerName && <p className="col-span-2"><span className="text-gray-400">Propriétaire : </span>{ownerName}</p>}
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">💉 Vaccins</h2>
          {vaccines.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun vaccin enregistré.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-200">
                  <th className="py-1.5 font-medium">Vaccin</th>
                  <th className="py-1.5 font-medium">Administré le</th>
                  <th className="py-1.5 font-medium">Rappel prévu</th>
                  <th className="py-1.5 font-medium">Par</th>
                </tr>
              </thead>
              <tbody>
                {vaccines.map((v: any) => (
                  <tr key={v.id} className="border-b border-gray-100">
                    <td className="py-1.5">{v.name}</td>
                    <td className="py-1.5">{format(new Date(v.date_administered), 'd MMM yyyy', { locale: fr })}</td>
                    <td className="py-1.5">{v.next_due_date ? format(new Date(v.next_due_date), 'd MMM yyyy', { locale: fr }) : '—'}</td>
                    <td className="py-1.5">{v.administered_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">⚖️ Suivi de poids</h2>
          {weights.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune mesure enregistrée.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-200">
                  <th className="py-1.5 font-medium">Date</th>
                  <th className="py-1.5 font-medium">Poids</th>
                  <th className="py-1.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {weights.map((w: any) => (
                  <tr key={w.id} className="border-b border-gray-100">
                    <td className="py-1.5">{format(new Date(w.measured_at), 'd MMM yyyy', { locale: fr })}</td>
                    <td className="py-1.5">{w.weight_kg} kg</td>
                    <td className="py-1.5">{w.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">📋 Historique de soins</h2>
          {records.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun dossier médical enregistré.</p>
          ) : (
            <div className="space-y-3">
              {records.map((r: any) => (
                <div key={r.id} className="border-b border-gray-100 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 text-sm">{r.title}</p>
                    <p className="text-xs text-gray-400">{format(new Date(r.date), 'd MMM yyyy', { locale: fr })}</p>
                  </div>
                  <p className="text-xs text-sage-600 mt-0.5">{r.type}{r.professional_name ? ` — ${r.professional_name}` : ''}</p>
                  {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="no-print mt-10 pt-4 border-t border-gray-100 text-xs text-gray-400">
          <Link to={`/animal/${id}`} className="text-sage-600 hover:underline">← Retour au dossier complet</Link>
        </footer>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
