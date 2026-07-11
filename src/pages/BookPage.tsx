// src/pages/BookPage.tsx
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDoctor, useAnimals } from '@/hooks/useData'
import { useCreateAppointment } from '@/hooks/useData'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import AvailabilityCalendar from '@/components/appointment/AvailabilityCalendar'
import { format, addMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { SPECIES_EMOJI } from '@/lib/animalSpecies'

type Step = 1 | 2 | 3

export default function BookPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const navigate = useNavigate()
  const { data: doctor } = useDoctor(doctorId!)
  const { data: animals = [] } = useAnimals()
  const createAppt = useCreateAppointment()

  const [step, setStep] = useState<Step>(1)
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)
  const [reason, setReason] = useState('')
  const [animalIds, setAnimalIds] = useState<string[]>([])
  const [animalSearch, setAnimalSearch] = useState('')
  const [documents, setDocuments] = useState<{ file_name: string; file_url: string; file_type: string }[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  // Envoi immédiat vers Supabase Storage dès la sélection (au lieu de garder
  // les File[] en mémoire jusqu'à la confirmation finale) : on obtient une
  // erreur claire tout de suite si l'upload échoue, plutôt qu'un échec
  // silencieux plus tard, et l'état porté entre les étapes reste léger
  // (juste l'URL/nom du fichier déjà envoyé).
  async function addDocuments(files: FileList | null) {
    if (!files || files.length === 0) return
    setDocError('')
    setDocUploading(true)
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `appointments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
        if (uploadError) throw uploadError
        const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)
        setDocuments(docs => [...docs, { file_name: file.name, file_url: pub.publicUrl, file_type: file.type }])
      }
    } catch (e: any) {
      setDocError(e.message ?? "Erreur lors de l'envoi du fichier.")
    } finally {
      setDocUploading(false)
    }
  }

  function removeDocument(index: number) {
    setDocuments(docs => docs.filter((_, i) => i !== index))
  }

  function toggleAnimal(id: string) {
    setAnimalIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  const filteredAnimals = animals.filter(a =>
    a.name.toLowerCase().includes(animalSearch.trim().toLowerCase())
  )

  const REASONS = [
    'Consultation générale', 'Renouvellement ordonnance',
    'Bilan annuel', 'Suivi de traitement', 'Urgence', 'Autre',
  ]

  const name = doctor?.profiles
    ? `${doctor.profiles.first_name} ${doctor.profiles.last_name}`
    : 'Praticien'

  async function confirm() {
    if (!selectedSlot || !doctorId) return
    const start = selectedSlot
    const end   = addMinutes(start, 30)
    await createAppt.mutateAsync({
      doctor_id: doctorId,
      start_at:  start.toISOString(),
      end_at:    end.toISOString(),
      reason,
      animal_ids: animalIds.length > 0 ? animalIds : undefined,
      documents: documents.length > 0 ? documents : undefined,
    })
    setStep(3)
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        <BackButton fallback={`/doctor/${doctorId}`} />

        {/* Fil d'Ariane médecin */}
        {doctor && (
          <div className="card p-4 flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-sage-700 font-bold">
              {name[0]}
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">{name}</p>
              <p className="text-xs text-sage-600">{doctor.specialty} · {doctor.consultation_price}€</p>
            </div>
            <Link to={`/doctor/${doctorId}`} className="ml-auto text-xs text-gray-400 hover:underline">Modifier</Link>
          </div>
        )}

        {/* Indicateur d'étape */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'Créneau' },
            { n: 2, label: 'Motif' },
            { n: 3, label: 'Confirmation' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${step >= s.n ? 'bg-sage-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className={`text-xs font-medium ${step >= s.n ? 'text-sage-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {i < 2 && <div className={`flex-1 h-0.5 ${step > s.n ? 'bg-sage-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* ÉTAPE 1 — Choix du créneau */}
        {step === 1 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Choisissez un créneau</h2>
            <AvailabilityCalendar
              doctorId={doctorId!}
              selected={selectedSlot}
              onSelect={setSelectedSlot}
            />
            {selectedSlot && (
              <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-sage-700 font-medium">
                  ✓ {format(selectedSlot, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                </p>
                <button className="btn-primary" onClick={() => setStep(2)}>
                  Continuer →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 2 — Motif */}
        {step === 2 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Motif de la consultation</h2>
            <p className="text-sm text-gray-500 mb-5">
              RDV prévu le{' '}
              <strong>{selectedSlot && format(selectedSlot, "EEEE d MMMM 'à' HH:mm", { locale: fr })}</strong>
            </p>

            {animals.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Pour quel(s) animal(aux) ? (facultatif, plusieurs possibles)</p>
                {animals.length > 5 && (
                  <input
                    type="text"
                    value={animalSearch}
                    onChange={e => setAnimalSearch(e.target.value)}
                    placeholder="Rechercher par nom..."
                    className="input text-sm mb-2"
                  />
                )}
                {filteredAnimals.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Aucun animal ne correspond à cette recherche.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {filteredAnimals.map(a => (
                      <button key={a.id} type="button"
                        onClick={() => toggleAnimal(a.id)}
                        className={`relative p-3 text-sm rounded-xl border text-center transition-colors
                          ${animalIds.includes(a.id) ? 'border-sage-400 bg-sage-50 text-sage-700 font-medium' : 'border-gray-200 hover:border-sage-300'}`}>
                        {animalIds.includes(a.id) && (
                          <span className="absolute top-1 right-1.5 text-sage-500 text-xs">✓</span>
                        )}
                        <span className="block text-xl mb-1">{SPECIES_EMOJI[a.species] ?? '🐾'}</span>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Le praticien pourra retrouver directement le dossier des animaux choisis.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              {REASONS.map(r => (
                <button key={r}
                  onClick={() => setReason(r)}
                  className={`p-3 text-sm rounded-xl border text-left transition-colors
                    ${reason === r ? 'border-sage-400 bg-sage-50 text-sage-700 font-medium' : 'border-gray-200 hover:border-sage-300'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              className="input resize-none" rows={2}
              placeholder="Précisez si nécessaire (facultatif)..." />

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-700 mb-2">Documents ou photos à joindre (facultatif)</p>
              <input type="file" disabled={docUploading}
                className="block w-full text-sm text-gray-600 cursor-pointer
                  file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                  file:bg-sage-500 file:text-white file:text-sm file:font-medium
                  hover:file:bg-sage-600 file:cursor-pointer disabled:opacity-50"
                onChange={e => { addDocuments(e.target.files); e.target.value = '' }} />
              {docUploading && <p className="text-xs text-sage-600 mt-2">Envoi en cours...</p>}
              {docError && <p className="text-xs text-red-500 mt-2">{docError}</p>}
              {documents.length > 0 && (
                <>
                  <ul className="mt-2 space-y-1">
                    {documents.map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="truncate">📄 {d.file_name}</span>
                        <button type="button" onClick={() => removeDocument(i)}
                          className="text-red-400 hover:underline ml-2 flex-shrink-0">Retirer</button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-2">Vous pouvez cliquer à nouveau sur le bouton pour ajouter d'autres fichiers.</p>
                </>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Ex : analyses, ordonnance, radios... Le praticien pourra les consulter avant le RDV.
              </p>
            </div>

            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setStep(1)}>← Retour</button>
              <button className="btn-primary flex-1" onClick={() => setStep(3)}>Récapitulatif →</button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Confirmation */}
        {step === 3 && !createAppt.isSuccess && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Confirmer le rendez-vous</h2>
            <div className="bg-sage-50 rounded-xl p-4 space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Praticien</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Spécialité</span>
                <span>{doctor?.specialty}</span>
              </div>
              {selectedSlot && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date & heure</span>
                  <span className="font-medium">
                    {format(selectedSlot, "EEEE d MMM 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
              )}
              {reason && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Motif</span>
                  <span>{reason}</span>
                </div>
              )}
              {animalIds.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{animalIds.length > 1 ? 'Animaux' : 'Animal'}</span>
                  <span>{animals.filter(a => animalIds.includes(a.id)).map(a => a.name).join(', ')}</span>
                </div>
              )}
              {documents.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pièces jointes</span>
                  <span>{documents.length} fichier{documents.length > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t border-sage-200">
                <span className="text-gray-500">Tarif</span>
                <span className="font-bold text-sage-700">{doctor?.consultation_price}€</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep(2)}>← Modifier</button>
              <button className="btn-primary flex-1" onClick={confirm} disabled={createAppt.isPending}>
                {createAppt.isPending ? 'Confirmation...' : '✓ Confirmer'}
              </button>
            </div>
            {createAppt.isError && (
              <p className="text-red-500 text-sm mt-3 text-center">
                {(createAppt.error as any)?.code === '23505'
                  ? 'Ce créneau est déjà pris. Veuillez en choisir un autre.'
                  : (createAppt.error as any)?.message || "Une erreur est survenue. Veuillez réessayer."}
              </p>
            )}
          </div>
        )}

        {/* Succès */}
        {createAppt.isSuccess && (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Rendez-vous confirmé !</h2>
            <p className="text-gray-500 text-sm mb-2">
              Votre rendez-vous avec <strong>{name}</strong> est enregistré.
            </p>
            <p className="text-gray-400 text-xs mb-6">
              Un email de confirmation vous a été envoyé.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/dashboard/patient" className="btn-primary">Voir mes RDV</Link>
              <Link to="/search" className="btn-secondary">Retour à la recherche</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
