// src/pages/AnimalHealthPage.tsx
import { useState, useEffect, Suspense, lazy } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fr } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { PARIS_TZ } from '@/lib/parisTime'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import {
  useAnimal,
  useCareItems,
  useWeightTracking,
  useHealthRecords,
  useCurrentDoctor,
  useCreateCareItem,
  useUpdateCareItem,
  useDeleteCareItem,
  useCreateWeight,
  useUpdateWeight,
  useDeleteWeight,
  useCreateHealthRecord,
  useUpdateHealthRecord,
  useDeleteHealthRecord,
  useUpdateAnimal,
  useDeleteAnimal,
  useAnimalOwner,
  useAnimalDocuments,
  useCreateAnimalDocument,
  useDeleteAnimalDocument,
  useOwnerReferralsForAnimal,
  useRespondToAnimalReferral,
  useReferralContext,
  useSentReferralsForAnimal,
  type DocumentType,
  type CareType,
} from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { SPECIES_EMOJI, BREED_PLACEHOLDER } from '@/lib/animalSpecies'
import { referralSenderStatusLabel, referralBadgeClass } from '@/lib/animalReferrals'
import { getPractitionerTypesBySpecialties } from '@/lib/practitionerTypes'
import SpeciesSelect from '@/components/ui/SpeciesSelect'
import { showToast } from '@/lib/toast'
import { compressImage } from '@/lib/compressImage'
import { CARE_TYPES, careTypeIcon, careTypeLabel } from '@/lib/careTypes'

const ReferAnimalModal = lazy(() => import('@/components/doctor/ReferAnimalModal'))

const WeightChart = lazy(() => import('@/components/animal/WeightChart'))

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  ordonnance: '💊 Ordonnance',
  analyse: '🧪 Analyse',
  radio: '🩻 Radio',
  certificat: '📜 Certificat',
  autre: '📄 Autre',
}

export default function AnimalHealthPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const isDoctor = user?.role === 'doctor'
  const { data: animal, isLoading } = useAnimal(id!)
  const { data: careItems = [] } = useCareItems(id!)
  const { data: weights = [] } = useWeightTracking(id!)
  const { data: records = [] } = useHealthRecords(id!)
  const { data: documents = [] } = useAnimalDocuments(id!)
  const { data: owner } = useAnimalOwner(isDoctor ? animal?.owner_id : undefined)
  // Onglets Suivis/Poids réservés aux vétérinaires (voir tab === 'care'/
  // 'weight' plus bas) : masqués pour un praticien non-vétérinaire (retiré
  // à sa demande du 08/09/2026, en préparant une démo à une
  // comportementaliste — le bouton "+ Ajouter un suivi" n'a pas de sens
  // pour son métier). Reste visible pour un patient (isDoctor false) et,
  // par défaut, tant que la spécialité du praticien n'est pas encore
  // chargée, pour éviter un flash "masqué puis affiché" chez un vétérinaire.
  const { data: currentDoctor } = useCurrentDoctor()
  // Union : un praticien à plusieurs métiers (ex: vétérinaire + naturopathe)
  // garde ses fonctionnalités vétérinaires dès que 'Vétérinaire' figure
  // parmi ses spécialités, peu importe les autres.
  const isNonVetDoctor = isDoctor && !!currentDoctor && !getPractitionerTypesBySpecialties(currentDoctor.specialties).some(t => t.id === 'veterinaire')
  const canSeeMedicalTabs = !isNonVetDoctor

  const doctorName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : ''

  // Partage de dossier entre praticiens (migration 105) : demandes en
  // attente côté propriétaire, et contexte "reçu en référence" côté
  // médecin destinataire (quand ce n'est pas un lien cabinet/RDV
  // classique qui donne accès à cette fiche).
  const { data: ownerReferrals = [] } = useOwnerReferralsForAnimal(!isDoctor ? id! : '')
  const { data: referralContext } = useReferralContext(id!, isDoctor ? currentDoctor?.id : undefined)
  const { data: sentReferrals = [] } = useSentReferralsForAnimal(id!, isDoctor ? currentDoctor?.id : undefined)
  const respondToReferral = useRespondToAnimalReferral()
  const [showReferModal, setShowReferModal] = useState(false)

  const createCareItem = useCreateCareItem()
  const updateCareItem = useUpdateCareItem()
  const deleteCareItem = useDeleteCareItem()
  const createWeight  = useCreateWeight()
  const updateWeight  = useUpdateWeight()
  const deleteWeight  = useDeleteWeight()
  const createRecord  = useCreateHealthRecord()
  const updateRecord  = useUpdateHealthRecord()
  const deleteRecord  = useDeleteHealthRecord()
  const updateAnimal  = useUpdateAnimal()
  const deleteAnimal  = useDeleteAnimal()
  const createDocument = useCreateAnimalDocument()
  const deleteDocument = useDeleteAnimalDocument()
  const [photoUploading, setPhotoUploading] = useState(false)

  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', species: 'Chien', breed: '', gender: '', date_of_birth: '', microchip_number: '', tattoo_number: ''
  })
  const [editError, setEditError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function openEditForm() {
    if (!animal) return
    setEditForm({
      name: animal.name ?? '',
      species: animal.species ?? 'Chien',
      breed: animal.breed ?? '',
      gender: animal.gender ?? '',
      date_of_birth: animal.date_of_birth ?? '',
      microchip_number: animal.microchip_number ?? '',
      tattoo_number: animal.tattoo_number ?? '',
    })
    setEditError('')
    setShowEditForm(true)
  }

  async function submitEdit() {
    if (!editForm.name || !editForm.species) return
    setEditError('')
    try {
      await updateAnimal.mutateAsync({
        id: id!,
        name: editForm.name,
        species: editForm.species,
        breed: editForm.breed || undefined,
        gender: editForm.gender || undefined,
        date_of_birth: editForm.date_of_birth || undefined,
        microchip_number: editForm.microchip_number || undefined,
        tattoo_number: editForm.tattoo_number || undefined,
      })
      setShowEditForm(false)
      showToast('✓ Fiche mise à jour avec succès !')
    } catch (e: any) {
      setEditError(e.message ?? "Erreur lors de l'enregistrement.")
    }
  }

  async function handleDelete() {
    await deleteAnimal.mutateAsync(id!)
    navigate('/dashboard/patient')
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    try {
      // Compressée avant l'envoi — une photo prise directement avec
      // l'appareil d'un téléphone pèse souvent plusieurs Mo en pleine
      // résolution, d'où l'envoi très lent constaté sur mobile (retour
      // d'Anaïs du 08/09/2026).
      const compressed = await compressImage(file)
      const ext  = compressed.name.split('.').pop()
      const path = `animals/${id}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateAnimal.mutateAsync({ id: id!, avatar_url: data.publicUrl })
    } catch (e) {
      // Best-effort silencieux comme le reste de la page (pas de state
      // d'erreur dédié ici) — mais sans avaler l'échec en enregistrant
      // quand même une avatar_url cassée, et sans laisser "..." affiché
      // indéfiniment si l'upload ou la sauvegarde échoue.
      console.error('Upload photo animal', e)
    } finally {
      setPhotoUploading(false)
    }
  }

  const [tab, setTab] = useState<'overview' | 'care' | 'weight' | 'records' | 'documents'>('overview')
  // Filet de sécurité : si isNonVetDoctor bascule à true après un premier
  // rendu où canSeeMedicalTabs valait encore true par défaut (currentDoctor
  // pas encore chargé), on ne doit pas rester coincé sur un onglet
  // désormais masqué.
  useEffect(() => {
    if (!canSeeMedicalTabs && (tab === 'care' || tab === 'weight')) setTab('overview')
  }, [canSeeMedicalTabs, tab])
  const [showCareForm, setShowCareForm] = useState(false)
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [docLabel, setDocLabel] = useState('')
  const [docType, setDocType] = useState<DocumentType>('autre')
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  const [careForm, setCareForm] = useState<{ care_type: CareType; name: string; date_administered: string; next_due_date: string; administered_by: string }>({ care_type: 'vaccine', name: '', date_administered: '', next_due_date: '', administered_by: '' })
  const [weightForm, setWeightForm] = useState({ weight_kg: '', measured_at: '', notes: '' })
  const [recordForm, setRecordForm] = useState({ date: '', type: 'Consultation', title: '', description: '', professional_name: '' })

  const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
  const [editWeightForm, setEditWeightForm] = useState({ weight_kg: '', measured_at: '', notes: '' })
  const [weightError, setWeightError] = useState('')

  const [editingCareId, setEditingCareId] = useState<string | null>(null)
  const [editCareForm, setEditCareForm] = useState<{ care_type: CareType; name: string; date_administered: string; next_due_date: string; administered_by: string }>({ care_type: 'vaccine', name: '', date_administered: '', next_due_date: '', administered_by: '' })
  const [careError, setCareError] = useState('')

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editRecordForm, setEditRecordForm] = useState({ date: '', type: 'Consultation', title: '', description: '', professional_name: '' })
  const [recordError, setRecordError] = useState('')

  // Pré-remplit le nom du praticien connecté dans les formulaires
  useEffect(() => {
    if (!isDoctor || !doctorName) return
    setCareForm(f => f.administered_by ? f : { ...f, administered_by: doctorName })
    setRecordForm(f => f.professional_name ? f : { ...f, professional_name: doctorName })
  }, [isDoctor, doctorName])

  if (isLoading) return <div className="min-h-screen bg-[#FFFAF0]"><Navbar /><div className="flex items-center justify-center h-64"><p className="text-gray-400">Chargement...</p></div></div>
  if (!animal) return <div className="min-h-screen bg-[#FFFAF0]"><Navbar /><div className="flex items-center justify-center h-64"><p className="text-gray-400">Animal introuvable</p></div></div>

  const lastWeight = weights.length > 0 ? weights[weights.length - 1] : null
  // `care_items` est trié par date_administered décroissante (voir
  // useCareItems) — prendre le premier avec un next_due_date renvoyait le
  // suivi le plus RÉCEMMENT administré, pas le rappel le plus proche (donc
  // potentiellement le moins urgent). Trié ici par échéance croissante.
  const nextCareItem = [...careItems]
    .filter(c => c.next_due_date)
    .sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime())[0]

  const emoji = SPECIES_EMOJI[animal.species] ?? '🐾'

  async function submitCareItem() {
    if (!careForm.name || !careForm.date_administered) return
    await createCareItem.mutateAsync({ ...careForm, animal_id: id! })
    setCareForm({ care_type: 'vaccine', name: '', date_administered: '', next_due_date: '', administered_by: isDoctor ? doctorName : '' })
    setShowCareForm(false)
  }

  function startEditCareItem(c: any) {
    setEditingCareId(c.id)
    setEditCareForm({
      care_type: c.care_type ?? 'vaccine',
      name: c.name ?? '',
      date_administered: c.date_administered ?? '',
      next_due_date: c.next_due_date ?? '',
      administered_by: c.administered_by ?? '',
    })
    setCareError('')
  }

  async function submitEditCareItem() {
    if (!editingCareId || !editCareForm.name || !editCareForm.date_administered) return
    setCareError('')
    try {
      await updateCareItem.mutateAsync({ id: editingCareId, animal_id: id!, ...editCareForm })
      setEditingCareId(null)
    } catch (e: any) {
      setCareError(e.message ?? "Erreur lors de l'enregistrement.")
    }
  }

  async function removeCareItem(c: any) {
    setCareError('')
    try {
      await deleteCareItem.mutateAsync({ id: c.id, animal_id: id! })
    } catch (e: any) {
      setCareError(e.message ?? "Erreur lors de la suppression.")
    }
  }

  async function submitWeight() {
    if (!weightForm.weight_kg || !weightForm.measured_at) return
    await createWeight.mutateAsync({ animal_id: id!, weight_kg: parseFloat(weightForm.weight_kg), measured_at: weightForm.measured_at, notes: weightForm.notes })
    setWeightForm({ weight_kg: '', measured_at: '', notes: '' })
    setShowWeightForm(false)
  }

  function startEditWeight(w: any) {
    setEditingWeightId(w.id)
    setEditWeightForm({ weight_kg: String(w.weight_kg), measured_at: w.measured_at, notes: w.notes ?? '' })
    setWeightError('')
  }

  async function submitEditWeight() {
    if (!editingWeightId || !editWeightForm.weight_kg || !editWeightForm.measured_at) return
    setWeightError('')
    try {
      await updateWeight.mutateAsync({
        id: editingWeightId,
        animal_id: id!,
        weight_kg: parseFloat(editWeightForm.weight_kg),
        measured_at: editWeightForm.measured_at,
        notes: editWeightForm.notes,
      })
      setEditingWeightId(null)
    } catch (e: any) {
      setWeightError(e.message ?? "Erreur lors de l'enregistrement.")
    }
  }

  async function removeWeight(w: any) {
    setWeightError('')
    try {
      await deleteWeight.mutateAsync({ id: w.id, animal_id: id! })
    } catch (e: any) {
      setWeightError(e.message ?? "Erreur lors de la suppression.")
    }
  }

  async function submitRecord() {
    if (!recordForm.title || !recordForm.date) return
    await createRecord.mutateAsync({ ...recordForm, animal_id: id! })
    setRecordForm({ date: '', type: 'Consultation', title: '', description: '', professional_name: isDoctor ? doctorName : '' })
    setShowRecordForm(false)
  }

  function startEditRecord(r: any) {
    setEditingRecordId(r.id)
    setEditRecordForm({
      date: r.date ?? '',
      type: r.type ?? 'Consultation',
      title: r.title ?? '',
      description: r.description ?? '',
      professional_name: r.professional_name ?? '',
    })
    setRecordError('')
  }

  async function submitEditRecord() {
    if (!editingRecordId || !editRecordForm.title || !editRecordForm.date) return
    setRecordError('')
    try {
      await updateRecord.mutateAsync({ id: editingRecordId, animal_id: id!, ...editRecordForm })
      setEditingRecordId(null)
    } catch (e: any) {
      setRecordError(e.message ?? "Erreur lors de l'enregistrement.")
    }
  }

  async function removeRecord(r: any) {
    setRecordError('')
    try {
      await deleteRecord.mutateAsync({ id: r.id, animal_id: id! })
    } catch (e: any) {
      setRecordError(e.message ?? "Erreur lors de la suppression.")
    }
  }

  async function handleDocUpload(file: File) {
    setDocError('')
    setDocUploading(true)
    try {
      await createDocument.mutateAsync({ animal_id: id!, file, label: docLabel, document_type: docType })
      setDocLabel('')
      setDocType('autre')
    } catch (e: any) {
      setDocError(e.message ?? "Erreur lors de l'envoi.")
    } finally {
      setDocUploading(false)
    }
  }

  async function removeDocument(docId: string) {
    setDocError('')
    try {
      await deleteDocument.mutateAsync({ id: docId, animal_id: id! })
    } catch (e: any) {
      setDocError(e.message ?? "Erreur lors de la suppression.")
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-4">
          <BackButton fallback={isDoctor ? '/dashboard/doctor?tab=patients' : '/dashboard/patient'} />
          <Link to={`/animal/${id}/carnet`}
            className="text-sm text-sage-600 hover:underline">
            📄 Carnet de santé exportable
          </Link>
        </div>

        {/* Photo pleine hauteur sur le côté gauche — option choisie par
            Anaïs le 07/09/2026 parmi plusieurs propositions, en cohérence
            avec la galerie photo de "Mes animaux". */}
        <div className="card mb-6 flex overflow-hidden">
          <div className="relative w-28 sm:w-36 flex-shrink-0 bg-sage-50 group">
            <div className="absolute inset-0 flex items-center justify-center text-5xl">
              {animal.avatar_url
                ? <img src={animal.avatar_url} className="w-full h-full object-cover" alt={animal.name} loading="lazy" />
                : emoji}
            </div>
            {!isDoctor && (
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <span className="text-white text-xs font-medium">
                  {photoUploading ? '...' : '📷'}
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
              </label>
            )}
          </div>
          <div className="flex-1 p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{animal.name}</h1>
              <span className="text-xs bg-sage-100 text-sage-700 px-2 py-1 rounded-full">{animal.species}</span>
              {animal.gender && <span className="text-gray-400 text-sm">{animal.gender}</span>}
            </div>
            <p className="text-gray-500 text-sm">{animal.breed ?? 'Race non renseignée'}</p>
            <div className="flex gap-1.5 flex-wrap mt-2.5">
              {animal.date_of_birth && (
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  🎂 {formatInTimeZone(new Date(animal.date_of_birth), PARIS_TZ, 'd MMM yyyy', { locale: fr })}
                </span>
              )}
              {lastWeight && (
                <span className="text-xs font-bold bg-moss-100 text-moss-800 px-2.5 py-1 rounded-full">
                  ⚖️ {lastWeight.weight_kg} kg
                </span>
              )}
              {animal.microchip_number && (
                <span className="text-xs font-bold bg-sage-100 text-sage-700 px-2.5 py-1 rounded-full">
                  📡 {animal.microchip_number}
                </span>
              )}
              {animal.tattoo_number && (
                <span className="text-xs font-bold bg-sage-100 text-sage-700 px-2.5 py-1 rounded-full">
                  🔖 {animal.tattoo_number}
                </span>
              )}
            </div>
            {isDoctor && owner && (
              <p className="text-xs text-sage-600 mt-2.5">👤 Propriétaire : {owner.first_name} {owner.last_name}</p>
            )}
            {isDoctor && currentDoctor && (
              <button onClick={() => setShowReferModal(true)} className="text-xs text-sage-600 hover:underline mt-2.5">
                🤝 Envoyer à un confrère
              </button>
            )}
            {isDoctor && sentReferrals.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sentReferrals.map((r: any) => (
                  <li key={r.id} className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
                    <span>→ {r.target_doctor?.profiles?.first_name} {r.target_doctor?.profiles?.last_name}</span>
                    <span className={referralBadgeClass(r.status)}>{referralSenderStatusLabel(r.status)}</span>
                  </li>
                ))}
              </ul>
            )}
            {isDoctor && referralContext && (
              <p className="text-xs text-amber-600 mt-2.5">
                🔗 Reçu en référence de {(referralContext.referring_doctor as any)?.profiles?.first_name} {(referralContext.referring_doctor as any)?.profiles?.last_name}
                {referralContext.reason ? ` — ${referralContext.reason}` : ''}
              </p>
            )}
            {!isDoctor && (
              <div className="flex gap-3 mt-2.5">
                <button onClick={openEditForm} className="text-xs text-sage-600 hover:underline">✏️ Modifier</button>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:underline">🗑️ Supprimer</button>
                ) : (
                  <span className="text-xs text-red-500 flex items-center gap-2">
                    Confirmer la suppression ?
                    <button onClick={handleDelete} disabled={deleteAnimal.isPending} className="underline font-medium">
                      {deleteAnimal.isPending ? 'Suppression...' : 'Oui'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="underline text-gray-400">Annuler</button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {!isDoctor && ownerReferrals.map((r: any) => (
          <div key={r.id} className={`card p-4 mb-4 border-2 ${r.status === 'pending' ? 'border-amber-200 bg-amber-50' : 'border-sage-200 bg-sage-50'}`}>
            <p className="text-sm text-gray-800">
              {r.status === 'pending' ? (
                <>
                  <strong>{r.referring_doctor?.profiles?.first_name} {r.referring_doctor?.profiles?.last_name}</strong> souhaite
                  transmettre le dossier de {animal.name} à <strong>{r.target_doctor?.profiles?.first_name} {r.target_doctor?.profiles?.last_name}</strong>.
                </>
              ) : (
                <>
                  <strong>{r.target_doctor?.profiles?.first_name} {r.target_doctor?.profiles?.last_name}</strong> a
                  accès au dossier de {animal.name} (transmis par {r.referring_doctor?.profiles?.first_name} {r.referring_doctor?.profiles?.last_name}).
                </>
              )}
            </p>
            {r.reason && <p className="text-xs text-gray-500 mt-1">« {r.reason} »</p>}
            <div className="flex gap-2 mt-3">
              {r.status === 'pending' ? (
                <>
                  <button onClick={() => respondToReferral.mutate({ id: r.id, animal_id: id!, status: 'accepted' })}
                    disabled={respondToReferral.isPending} className="btn-primary text-sm">Accepter</button>
                  <button onClick={() => respondToReferral.mutate({ id: r.id, animal_id: id!, status: 'declined' })}
                    disabled={respondToReferral.isPending} className="btn-secondary text-sm">Refuser</button>
                </>
              ) : (
                <button onClick={() => respondToReferral.mutate({ id: r.id, animal_id: id!, status: 'revoked' })}
                  disabled={respondToReferral.isPending} className="text-xs text-red-500 hover:underline">🗑️ Révoquer l'accès</button>
              )}
            </div>
          </div>
        ))}

        {!isDoctor && showEditForm && (
          <div className="card p-5 mb-6 border-2 border-sage-200">
            <h3 className="font-semibold text-sm mb-4">Modifier {animal.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Nom *</label>
                <input className="input text-sm mt-1" value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Espèce *</label>
                <SpeciesSelect value={editForm.species}
                  onChange={species => setEditForm(f => ({ ...f, species, breed: '' }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Race</label>
                <input className="input text-sm mt-1" value={editForm.breed}
                  onChange={e => setEditForm(f => ({ ...f, breed: e.target.value }))}
                  placeholder={BREED_PLACEHOLDER[editForm.species] ?? 'Ex: ...'} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Genre</label>
                <select className="input text-sm mt-1" value={editForm.gender}
                  onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">Non renseigné</option>
                  <option>Mâle</option>
                  <option>Femelle</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Date de naissance</label>
                <input type="date" className="input text-sm mt-1" value={editForm.date_of_birth}
                  onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">N° puce électronique</label>
                <input className="input text-sm mt-1" value={editForm.microchip_number}
                  onChange={e => setEditForm(f => ({ ...f, microchip_number: e.target.value }))}
                  placeholder="Ex: 250268500000000" />
              </div>
              <div>
                <label className="text-xs text-gray-500">N° de tatouage</label>
                <input className="input text-sm mt-1" value={editForm.tattoo_number}
                  onChange={e => setEditForm(f => ({ ...f, tattoo_number: e.target.value }))}
                  placeholder="Si l'animal n'est pas pucé" />
              </div>
            </div>
            {editError && <p className="text-red-500 text-sm mt-3">{editError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={submitEdit} disabled={updateAnimal.isPending} className="btn-primary text-sm">
                {updateAnimal.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowEditForm(false)} className="btn-secondary text-sm">Annuler</button>
            </div>
          </div>
        )}

        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
          {([['overview', '📋 Résumé'], ['care', '🔔 Suivis'], ['weight', '⚖️ Poids'], ['records', '📁 Dossier'], ['documents', '📎 Documents']] as const)
            .filter(([t]) => canSeeMedicalTabs || (t !== 'care' && t !== 'weight'))
            .map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-rise-in">
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">🔔 Suivis</h3>
              <p className="text-3xl font-bold text-sage-600 mb-1">{careItems.length}</p>
              <p className="text-xs text-gray-400">suivis enregistrés</p>
              {nextCareItem && <p className="text-xs text-amber-600 mt-2">⏰ Rappel : {formatInTimeZone(new Date(nextCareItem.next_due_date!), PARIS_TZ, 'd MMM yyyy', { locale: fr })}</p>}
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">⚖️ Poids actuel</h3>
              <p className="text-3xl font-bold text-moss-600 mb-1">{lastWeight ? `${lastWeight.weight_kg} kg` : '—'}</p>
              <p className="text-xs text-gray-400">{lastWeight ? formatInTimeZone(new Date(lastWeight.measured_at), PARIS_TZ, 'd MMM yyyy', { locale: fr }) : 'Aucune mesure'}</p>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">📁 Événements</h3>
              <p className="text-3xl font-bold text-sage-700 mb-1">{records.length}</p>
              <p className="text-xs text-gray-400">dans le dossier</p>
            </div>
          </div>
        )}

        {tab === 'care' && canSeeMedicalTabs && (
          <div className="animate-rise-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Suivis de {animal.name}</h2>
              <button onClick={() => setShowCareForm(true)} className="btn-primary text-sm">+ Ajouter</button>
            </div>
            {showCareForm && (
              <div className="card p-5 mb-4 border-2 border-sage-200">
                <h3 className="font-semibold text-sm mb-3">Nouveau suivi</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Type de suivi *</label>
                    <select className="input text-sm mt-1" value={careForm.care_type} onChange={e => setCareForm(f => ({...f, care_type: e.target.value as CareType}))}>
                      {CARE_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500">Nom *</label><input className="input text-sm mt-1" value={careForm.name} onChange={e => setCareForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Rage, Carré, Vermifuge annuel..." /></div>
                  <div><label className="text-xs text-gray-500">Date de réalisation *</label><input type="date" className="input text-sm mt-1" value={careForm.date_administered} onChange={e => setCareForm(f => ({...f, date_administered: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Prochain rappel</label><input type="date" className="input text-sm mt-1" value={careForm.next_due_date} onChange={e => setCareForm(f => ({...f, next_due_date: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Réalisé par</label><input className="input text-sm mt-1" value={careForm.administered_by} onChange={e => setCareForm(f => ({...f, administered_by: e.target.value}))} placeholder="Dr..." /></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={submitCareItem} className="btn-primary text-sm">Enregistrer</button>
                  <button onClick={() => setShowCareForm(false)} className="btn-secondary text-sm">Annuler</button>
                </div>
              </div>
            )}
            {careError && <p className="text-red-500 text-sm mb-3">{careError}</p>}
            {careItems.length === 0
              ? <div className="card p-10 text-center"><p className="text-gray-400 text-sm">Aucun suivi enregistré.</p></div>
              : <div className="space-y-3">{careItems.map(c => (
                  editingCareId === c.id ? (
                    <div key={c.id} className="card p-5 border-2 border-sage-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">Type de suivi *</label>
                          <select className="input text-sm mt-1" value={editCareForm.care_type} onChange={e => setEditCareForm(f => ({...f, care_type: e.target.value as CareType}))}>
                            {CARE_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                          </select>
                        </div>
                        <div><label className="text-xs text-gray-500">Nom *</label><input className="input text-sm mt-1" value={editCareForm.name} onChange={e => setEditCareForm(f => ({...f, name: e.target.value}))} /></div>
                        <div><label className="text-xs text-gray-500">Date de réalisation *</label><input type="date" className="input text-sm mt-1" value={editCareForm.date_administered} onChange={e => setEditCareForm(f => ({...f, date_administered: e.target.value}))} /></div>
                        <div><label className="text-xs text-gray-500">Prochain rappel</label><input type="date" className="input text-sm mt-1" value={editCareForm.next_due_date} onChange={e => setEditCareForm(f => ({...f, next_due_date: e.target.value}))} /></div>
                        <div><label className="text-xs text-gray-500">Réalisé par</label><input className="input text-sm mt-1" value={editCareForm.administered_by} onChange={e => setEditCareForm(f => ({...f, administered_by: e.target.value}))} /></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={submitEditCareItem} disabled={updateCareItem.isPending} className="btn-primary text-sm">
                          {updateCareItem.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditingCareId(null)} className="btn-secondary text-sm">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div key={c.id} className="card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg">{careTypeIcon(c.care_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">
                          {c.name}
                          <span className="text-gray-400 font-normal"> · {careTypeLabel(c.care_type)}</span>
                        </p>
                        <p className="text-xs text-gray-500">Le {formatInTimeZone(new Date(c.date_administered), PARIS_TZ, 'd MMM yyyy', { locale: fr })}{c.administered_by ? ` · ${c.administered_by}` : ''}</p>
                      </div>
                      {c.next_due_date && <div className="text-right"><p className="text-xs text-amber-600 font-medium">Rappel</p><p className="text-xs text-gray-500">{formatInTimeZone(new Date(c.next_due_date), PARIS_TZ, 'd MMM yyyy', { locale: fr })}</p></div>}
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => startEditCareItem(c)} className="text-xs text-sage-600 hover:underline">✏️</button>
                        <button onClick={() => removeCareItem(c)} disabled={deleteCareItem.isPending} className="text-xs text-red-400 hover:underline">🗑️</button>
                      </div>
                    </div>
                  )
                ))}</div>
            }
          </div>
        )}

        {tab === 'weight' && canSeeMedicalTabs && (
          <div className="animate-rise-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Suivi du poids</h2>
              <button onClick={() => setShowWeightForm(true)} className="btn-primary text-sm">+ Ajouter</button>
            </div>
            {showWeightForm && (
              <div className="card p-5 mb-4 border-2 border-sage-200">
                <h3 className="font-semibold text-sm mb-3">Nouvelle mesure</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Poids (kg) *</label><input type="number" step="0.1" className="input text-sm mt-1" value={weightForm.weight_kg} onChange={e => setWeightForm(f => ({...f, weight_kg: e.target.value}))} placeholder="Ex: 4.5" /></div>
                  <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="input text-sm mt-1" value={weightForm.measured_at} onChange={e => setWeightForm(f => ({...f, measured_at: e.target.value}))} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><input className="input text-sm mt-1" value={weightForm.notes} onChange={e => setWeightForm(f => ({...f, notes: e.target.value}))} placeholder="Ex: après repas..." /></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={submitWeight} className="btn-primary text-sm">Enregistrer</button>
                  <button onClick={() => setShowWeightForm(false)} className="btn-secondary text-sm">Annuler</button>
                </div>
              </div>
            )}
            {/* Courbe de poids — recharts chargé en lazy (voir WeightChart.tsx),
                seulement quand cette section est réellement affichée. */}
            {weights.length >= 2 && (
              <div className="card p-5 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Courbe de poids</h3>
                <Suspense fallback={<div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">Chargement du graphique...</div>}>
                  <WeightChart weights={weights} species={animal.species} />
                </Suspense>
              </div>
            )}

            {weightError && <p className="text-red-500 text-sm mb-3">{weightError}</p>}

            {weights.length === 0
              ? <div className="card p-10 text-center"><p className="text-gray-400 text-sm">Aucune mesure enregistrée.</p></div>
              : <div className="space-y-3">{[...weights].reverse().map((w, i) => (
                  editingWeightId === w.id ? (
                    <div key={w.id} className="card p-4 border-2 border-sage-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">Poids (kg) *</label>
                          <input type="number" step="0.1" className="input text-sm mt-1" value={editWeightForm.weight_kg}
                            onChange={e => setEditWeightForm(f => ({ ...f, weight_kg: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Date *</label>
                          <input type="date" className="input text-sm mt-1" value={editWeightForm.measured_at}
                            onChange={e => setEditWeightForm(f => ({ ...f, measured_at: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Notes</label>
                          <input className="input text-sm mt-1" value={editWeightForm.notes}
                            onChange={e => setEditWeightForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={submitEditWeight} disabled={updateWeight.isPending} className="btn-primary text-sm">
                          {updateWeight.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditingWeightId(null)} className="btn-secondary text-sm">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div key={w.id} className="card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-moss-50 flex items-center justify-center text-lg">⚖️</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{w.weight_kg} kg</p>
                        <p className="text-xs text-gray-500">{formatInTimeZone(new Date(w.measured_at), PARIS_TZ, 'd MMM yyyy', { locale: fr })}{w.notes ? ` · ${w.notes}` : ''}</p>
                      </div>
                      {i === 0 && <span className="text-xs bg-moss-100 text-moss-700 px-2 py-1 rounded-full">Dernier</span>}
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => startEditWeight(w)} className="text-xs text-sage-600 hover:underline">✏️</button>
                        <button onClick={() => removeWeight(w)} disabled={deleteWeight.isPending} className="text-xs text-red-400 hover:underline">🗑️</button>
                      </div>
                    </div>
                  )
                ))}</div>
            }
          </div>
        )}

        {tab === 'records' && (
          <div className="animate-rise-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Dossier de santé</h2>
              <button onClick={() => setShowRecordForm(true)} className="btn-primary text-sm">+ Ajouter</button>
            </div>
            {showRecordForm && (
              <div className="card p-5 mb-4 border-2 border-sage-200">
                <h3 className="font-semibold text-sm mb-3">Nouvel événement</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Type</label>
                    <select className="input text-sm mt-1" value={recordForm.type} onChange={e => setRecordForm(f => ({...f, type: e.target.value}))}>
                      {['Consultation', 'Chirurgie', 'Traitement', 'Toilettage', 'Ostéopathie', 'Analyse', 'Autre'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="input text-sm mt-1" value={recordForm.date} onChange={e => setRecordForm(f => ({...f, date: e.target.value}))} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Titre *</label><input className="input text-sm mt-1" value={recordForm.title} onChange={e => setRecordForm(f => ({...f, title: e.target.value}))} placeholder="Ex: Consultation annuelle..." /></div>
                  <div><label className="text-xs text-gray-500">Professionnel</label><input className="input text-sm mt-1" value={recordForm.professional_name} onChange={e => setRecordForm(f => ({...f, professional_name: e.target.value}))} placeholder="Dr..." /></div>
                  <div><label className="text-xs text-gray-500">Description</label><input className="input text-sm mt-1" value={recordForm.description} onChange={e => setRecordForm(f => ({...f, description: e.target.value}))} placeholder="Notes..." /></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={submitRecord} className="btn-primary text-sm">Enregistrer</button>
                  <button onClick={() => setShowRecordForm(false)} className="btn-secondary text-sm">Annuler</button>
                </div>
              </div>
            )}
            {recordError && <p className="text-red-500 text-sm mb-3">{recordError}</p>}
            {records.length === 0
              ? <div className="card p-10 text-center"><p className="text-gray-400 text-sm">Aucun événement enregistré.</p></div>
              : <div className="space-y-3">{records.map(r => {
                  const typeEmoji: Record<string, string> = { Consultation: '🩺', Chirurgie: '🔬', Traitement: '💊', Toilettage: '✂️', Ostéopathie: '🤲', Analyse: '🧪', Autre: '📋' }
                  if (editingRecordId === r.id) {
                    return (
                      <div key={r.id} className="card p-5 border-2 border-sage-200">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs text-gray-500">Type</label>
                            <select className="input text-sm mt-1" value={editRecordForm.type} onChange={e => setEditRecordForm(f => ({...f, type: e.target.value}))}>
                              {['Consultation', 'Chirurgie', 'Traitement', 'Toilettage', 'Ostéopathie', 'Analyse', 'Autre'].map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="input text-sm mt-1" value={editRecordForm.date} onChange={e => setEditRecordForm(f => ({...f, date: e.target.value}))} /></div>
                          <div className="col-span-2"><label className="text-xs text-gray-500">Titre *</label><input className="input text-sm mt-1" value={editRecordForm.title} onChange={e => setEditRecordForm(f => ({...f, title: e.target.value}))} /></div>
                          <div><label className="text-xs text-gray-500">Professionnel</label><input className="input text-sm mt-1" value={editRecordForm.professional_name} onChange={e => setEditRecordForm(f => ({...f, professional_name: e.target.value}))} /></div>
                          <div><label className="text-xs text-gray-500">Description</label><input className="input text-sm mt-1" value={editRecordForm.description} onChange={e => setEditRecordForm(f => ({...f, description: e.target.value}))} /></div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={submitEditRecord} disabled={updateRecord.isPending} className="btn-primary text-sm">
                            {updateRecord.isPending ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                          <button onClick={() => setEditingRecordId(null)} className="btn-secondary text-sm">Annuler</button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={r.id} className="card p-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-lg">{typeEmoji[r.type] ?? '📋'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-gray-900">{r.title}</p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{r.type}</span>
                        </div>
                        <p className="text-xs text-gray-500">{formatInTimeZone(new Date(r.date), PARIS_TZ, 'd MMM yyyy', { locale: fr })}{r.professional_name ? ` · ${r.professional_name}` : ''}</p>
                        {r.description && <p className="text-xs text-gray-400 mt-1">{r.description}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => startEditRecord(r)} className="text-xs text-sage-600 hover:underline">✏️</button>
                        <button onClick={() => removeRecord(r)} disabled={deleteRecord.isPending} className="text-xs text-red-400 hover:underline">🗑️</button>
                      </div>
                    </div>
                  )
                })}</div>
            }
          </div>
        )}

        {tab === 'documents' && (
          <div className="animate-rise-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Documents & photos</h2>
            </div>

            <div className="card p-5 mb-4 border-2 border-sage-200">
              <h3 className="font-semibold text-sm mb-3">Ajouter un document ou une photo</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500">Type</label>
                  <select className="input text-sm mt-1" value={docType}
                    onChange={e => setDocType(e.target.value as DocumentType)}>
                    <option value="ordonnance">💊 Ordonnance</option>
                    <option value="analyse">🧪 Analyse</option>
                    <option value="radio">🩻 Radio</option>
                    <option value="certificat">📜 Certificat</option>
                    <option value="autre">📄 Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Description (facultatif)</label>
                  <input className="input text-sm mt-1" value={docLabel}
                    onChange={e => setDocLabel(e.target.value)}
                    placeholder="Ex: Amoxicilline 10j..." />
                </div>
              </div>
              <input type="file" disabled={docUploading}
                className="block w-full text-sm text-gray-600 cursor-pointer
                  file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                  file:bg-sage-500 file:text-white file:text-sm file:font-medium
                  hover:file:bg-sage-600 file:cursor-pointer disabled:opacity-50"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = '' }} />
              {docUploading && <p className="text-xs text-gray-400 mt-2">Envoi en cours...</p>}
            </div>

            {docError && <p className="text-red-500 text-sm mb-3">{docError}</p>}

            {documents.length === 0
              ? <div className="card p-10 text-center"><p className="text-gray-400 text-sm">Aucun document envoyé.</p></div>
              : <div className="space-y-3">{documents.map((d: any) => (
                  <div key={d.id} className="card p-4 flex items-center gap-4">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-sage-50 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                      {d.file_type?.startsWith('image/')
                        ? <img src={d.file_url} className="w-full h-full object-cover" alt={d.file_name} loading="lazy" />
                        : '📄'}
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-sm text-gray-900 hover:underline truncate">
                          {d.label || d.file_name}
                        </a>
                        <span className="text-xs bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full flex-shrink-0">
                          {DOC_TYPE_LABELS[d.document_type as DocumentType] ?? DOC_TYPE_LABELS.autre}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Déposé par {d.uploaded_by === user?.id ? 'vous' : d.uploaderName} le {formatInTimeZone(new Date(d.created_at), PARIS_TZ, "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    {d.uploaded_by === user?.id && (
                      <button onClick={() => removeDocument(d.id)} disabled={deleteDocument.isPending}
                        className="text-xs text-red-400 hover:underline flex-shrink-0">🗑️</button>
                    )}
                  </div>
                ))}</div>
            }
          </div>
        )}
      </div>

      {showReferModal && currentDoctor && (
        <Suspense fallback={null}>
          <ReferAnimalModal animalId={id!} referringDoctorId={currentDoctor.id} onClose={() => setShowReferModal(false)} />
        </Suspense>
      )}
    </div>
  )
}
