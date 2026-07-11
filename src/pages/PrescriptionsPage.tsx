// src/pages/PrescriptionsPage.tsx
// Vue "Ordonnances" du dashboard patient : regroupe les documents de type
// "ordonnance" de tous ses animaux (voir animal_documents.document_type,
// migration 032). Réutilise le même stockage/RLS que l'onglet Documents du
// dossier animal — pas de nouvelle table, juste un filtre + une vue globale.
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import { usePatientPrescriptions } from '@/hooks/useData'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'

export default function PrescriptionsPage() {
  const { data: prescriptions = [], isLoading, error } = usePatientPrescriptions()

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <BackButton fallback="/dashboard/patient" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">💊 Ordonnances</h1>
          <p className="text-gray-500 text-sm mt-1">Toutes les ordonnances de vos animaux, au même endroit.</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="card p-5 mb-4 border-2 border-red-200">
            <p className="text-sm text-red-500">
              Impossible de charger vos ordonnances pour le moment. Réessayez dans un instant.
            </p>
          </div>
        )}

        {!isLoading && !error && prescriptions.length === 0 && (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">💊</div>
            <p className="text-gray-500 text-sm">
              Aucune ordonnance pour l'instant. Elles apparaîtront ici dès qu'un praticien (ou vous) en ajoute une
              dans le dossier d'un animal.
            </p>
          </div>
        )}

        {!isLoading && !error && prescriptions.length > 0 && (
          <div className="space-y-3">
            {prescriptions.map((p: any) => (
              <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer"
                className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-sage-50 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                  {p.file_type?.startsWith('image/')
                    ? <img src={p.file_url} className="w-full h-full object-cover" alt={p.file_name} />
                    : '💊'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{p.label || p.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {p.animals?.name && `${SPECIES_EMOJI[p.animals.species] ?? '🐾'} ${p.animals.name} · `}
                    {format(new Date(p.created_at), 'd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
