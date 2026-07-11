// src/pages/PatientDocumentsPage.tsx
// Vue "Documents" du dashboard patient : regroupe tous les documents
// (ordonnances, analyses, radios, certificats...) déposés par un praticien
// dans le dossier de ses animaux — pas ceux que le patient a lui-même
// envoyés, déjà visibles dans l'onglet "Documents" de chaque animal.
// Réutilise le même stockage/RLS que cet onglet — pas de nouvelle table.
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import { usePatientDoctorDocuments } from '@/hooks/useData'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'
import { DOC_TYPE_LABELS } from '@/pages/AnimalHealthPage'

export default function PatientDocumentsPage() {
  const { data: documents = [], isLoading, error } = usePatientDoctorDocuments()

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <BackButton fallback="/dashboard/patient" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">📄 Documents</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ordonnances, analyses, radios... tout ce que vos praticiens ont déposé dans le dossier de vos animaux.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="card p-5 mb-4 border-2 border-red-200">
            <p className="text-sm text-red-500">
              Impossible de charger vos documents pour le moment. Réessayez dans un instant.
            </p>
          </div>
        )}

        {!isLoading && !error && documents.length === 0 && (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-500 text-sm">
              Aucun document pour l'instant. Il apparaîtra ici dès qu'un praticien en ajoute un dans le dossier
              d'un de vos animaux.
            </p>
          </div>
        )}

        {!isLoading && !error && documents.length > 0 && (
          <div className="space-y-3">
            {documents.map((d: any) => {
              const doctorProfile = d.source === 'appointment' ? d.appointments?.doctors?.profiles : null
              return (
                <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer"
                  className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-sage-50 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                    {d.file_type?.startsWith('image/')
                      ? <img src={d.file_url} className="w-full h-full object-cover" alt={d.file_name} />
                      : '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{d.label || d.file_name}</p>
                      <span className="text-xs bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        {d.source === 'animal'
                          ? DOC_TYPE_LABELS[d.document_type as keyof typeof DOC_TYPE_LABELS] ?? DOC_TYPE_LABELS.autre
                          : '📎 Pièce jointe RDV'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {d.source === 'animal' && d.animals?.name && `${SPECIES_EMOJI[d.animals.species] ?? '🐾'} ${d.animals.name} · `}
                      {d.source === 'appointment' && doctorProfile && `Dr ${doctorProfile.first_name} ${doctorProfile.last_name} · `}
                      {format(new Date(d.created_at), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
