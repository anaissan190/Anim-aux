// src/pages/AnimalHealthPage.tsx
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Navbar from '@/components/ui/Navbar'
import {
  useAnimal,
  useVaccines,
  useWeightTracking,
  useHealthRecords,
  useCreateVaccine,
  useUpdateVaccine,
  useDeleteVaccine,
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
} from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { supabase } from '@/lib/supabase'
import { SPECIES_EMOJI, SPECIES_MAX_WEIGHT, BREED_PLACEHOLDER } from '@/lib/animalSpecies'
import SpeciesSelect from '@/components/ui/SpeciesSelect'

export default function AnimalHealthPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const isDoctor = user?.role === 'doctor'
  const { data: animal, isLoading } = useAnimal(id!)
  const { data: vaccines = [] } = useVaccines(id!)
  const { data: weights = [] } = useWeightTracking(id!)
  const { data: records = [] } = useHealthRecords(id!)
  const { data: documents = [] } = useAnimalDocuments(id!)
  const { data: owner } = useAnimalOwner(isDoctor ? animal?.owner_id : undefined)

  const doctorName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : ''

  const createVaccine = useCreateVaccine()
  const updateVaccine = useUpdateVaccine()
  const deleteVaccine = useDeleteVaccine()
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
    const ext  = file.name.split('.').pop()
    const path = `animals/${id}-${Date.now()}.${ext}`
    await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateAnimal.mutateAsync({ id: id!, avatar_url: data.publicUrl })
    setPhotoUploading(false)
  }

  const [tab, setTab] = useState<'overview' | 'vaccines' | 'weight' | 'records' | 'documents'>('overview')
  const [showVaccineForm, setShowVaccineForm] = useState(false)
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [docLabel, setDocLabel] = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  const [vaccineForm, setVaccineForm] = useState({ name: '', date_administered: '', next_due_date: '', administered_by: '' })
  const [weightForm, setWeightForm] = useState({ weight_kg: '', measured_at: '', notes: '' })
  const [recordForm, setRecordForm] = useState({ date: '', type: 'Consultation', title: '', description: '', professional_name: '' })

  const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
  const [editWeightForm, setEditWeightForm] = useState({ weight_kg: '', measured_at: '', notes: '' })
  const [weightError, setWeightError] = useState('')

  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null)
  const [editVaccineForm, setEditVaccineForm] = useState({ name: '', date_administered: '', next_due_date: '', administered_by: '' })
  const [vaccineError, setVaccineError] = useState('')

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editRecordForm, setEditRecordForm] = useState({ date: '', type: 'Consultation', title: '', description: '', professional_name: '' })
  const [recordError, setRecordError] = useState('')

  // Pré-remplit le nom du praticien connecté dans les formulaires
  useEffect(() => {
    if (!isDoctor || !doctorName) return
    setVaccineForm(f => f.administered_by ? f : { ...f, administered_by: doctorName })
    setRecordForm(f => f.professional_name ? f : { ...f, professional_name: doctorName })
  }, [isDoctor, doctorName])

  if (isLoading) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="flex items-center justify-center h-64"><p className="text-gray-400">Chargement...</p></div></div>
  if (!animal) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="flex items-center justify-center h-64"><p className="text-gray-400">Animal introuvable</p></div></div>

  const lastWeight = weights.length > 0 ? weights[weights.length - 1] : null
  const nextVaccine = vaccines.find(v => v.next_due_date)

  const emoji = SPECIES_EMOJI[animal.species] ?? '🐾'

  async function submitVaccine() {
    if (!vaccineForm.name || !vaccineForm.date_administered) return
    await createVaccine.mutateAsync({ ...vaccineForm, animal_id: id! })
    setVaccineForm({ name: '', date_administered: '', next_due_date: '', administered_by: isDoctor ? doctorName : '' })
    setShowVaccineForm(false)
  }

  function startEditVaccine(v: any) {
    setEditingVaccineId(v.id)
    setEditVaccineForm({
      name: v.name ?? '',
      date_administered: v.date_administered ?? '',
      next_due_date: v.next_due_date ?? '',
      administered_by: v.administered_by ?? '',
    })
    setVaccineError('')
  }

  async function submitEditVaccine() {
    if (!editingVaccineId || !editVaccineForm.name || !editVaccineForm.date_administered) return
    setVaccineError('')
    try {
      await updateVaccine.mutateAsync({ id: editingVaccineId, animal_id: id!, ...editVaccineForm })
      setEditingVaccineId(null)
    } catch (e: any) {
      setVaccineError(e.message ?? "Erreur lors de l'enregistrement.")
    }
  }

  async function removeVaccine(v: any) {
    setVaccineError('')
    try {
      await deleteVaccine.mutateAsync({ id: v.id, animal_id: id! })
    } catch (e: any) {
      setVaccineError(e.message ?? "Erreur lors de la suppression.")
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
      await createDocument.mutateAsync({ animal_id: id!, file, label: docLabel })
      setDocLabel('')
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="card p-6 mb-6 flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0 group">
            <div className="w-20 h-20 rounded-2xl bg-sage-50 flex items-center justify-center text-4xl overflow-hidden">
              {animal.avatar_url
                ? <img src={animal.avatar_url} className="w-full h-full object-cover" alt={animal.name} />
                : emoji}
            </div>
            {!isDoctor && (
              <label className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <span className="text-white text-xs font-medium">
                  {photoUploading ? '...' : '📷'}
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
              </label>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{animal.name}</h1>
              <span className="text-xs bg-sage-100 text-sage-700 px-2 py-1 rounded-full">{animal.species}</span>
              {animal.gender && <span className="text-gray-400 text-sm">{animal.gender}</span>}
            </div>
            <p className="text-gray-500 text-sm">{animal.breed ?? 'Race non renseignée'}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              {animal.date_of_birth && <span>🎂 {format(new Date(animal.date_of_birth), 'd MMM yyyy', { locale: fr })}</span>}
              {lastWeight && <span>⚖️ {lastWeight.weight_kg} kg</span>}
              {animal.microchip_number && <span>📡 {animal.microchip_number}</span>}
              {animal.tattoo_number && <span>🔖 {animal.tattoo_number}</span>}
            </div>
            {isDoctor && owner && (
              <p className="text-xs text-sage-600 mt-2">👤 Propriétaire : {owner.first_name} {owner.last_name}</p>
            )}
            {!isDoctor && (
              <div className="flex gap-3 mt-2">
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
          <Link to={isDoctor ? '/dashboard/doctor' : '/dashboard/patient'} className="text-sm text-gray-500 hover:text-gray-700">← Retour</Link>
        </div>

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
          {([['overview', '📋 Résumé'], ['vaccines', '💉 Vaccins'], ['weight', '⚖️ Poids'], ['records', '📁 Dossier'], ['documents', '📎 Documents']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">💉 Vaccins</h3>
              <p className="text-3xl font-bold text-sage-600 mb-1">{vaccines.length}</p>
              <p className="text-xs text-gray-400">vaccins enregistrés</p>
              {nextVaccine && <p className="text-xs text-amber-600 mt-2">⏰ Rappel : {format(new Date(nextVaccine.next_due_date!), 'd MMM yyyy', { locale: fr })}</p>}
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">⚖️ Poids actuel</h3>
              <p className="text-3xl font-bold text-blue-600 mb-1">{lastWeight ? `${lastWeight.weight_kg} kg` : '—'}</p>
              <p className="text-xs text-gray-400">{lastWeight ? format(new Date(lastWeight.measured_at), 'd MMM yyyy', { locale: fr }) : 'Aucune mesure'}</p>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">📁 Événements</h3>
              <p className="text-3xl font-bold text-purple-600 mb-1">{records.length}</p>
              <p className="text-xs text-gray-400">dans le dossier</p>
            </div>
          </div>
        )}

        {tab === 'vaccines' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Vaccins de {animal.name}</h2>
              <button onClick={() => setShowVaccineForm(true)} className="btn-primary text-sm">+ Ajouter</button>
            </div>
            {showVaccineForm && (
              <div className="card p-5 mb-4 border-2 border-sage-200">
                <h3 className="font-semibold text-sm mb-3">Nouveau vaccin</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Nom du vaccin *</label><input className="input text-sm mt-1" value={vaccineForm.name} onChange={e => setVaccineForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Rage, Carré..." /></div>
                  <div><label className="text-xs text-gray-500">Date administration *</label><input type="date" className="input text-sm mt-1" value={vaccineForm.date_administered} onChange={e => setVaccineForm(f => ({...f, date_administered: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Prochain rappel</label><input type="date" className="input text-sm mt-1" value={vaccineForm.next_due_date} onChange={e => setVaccineForm(f => ({...f, next_due_date: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Administré par</label><input className="input text-sm mt-1" value={vaccineForm.administered_by} onChange={e => setVaccineForm(f => ({...f, administered_by: e.target.value}))} placeholder="Dr..." /></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={submitVaccine} className="btn-primary text-sm">Enregistrer</button>
                  <button onClick={() => setShowVaccineForm(false)} className="btn-secondary text-sm">Annuler</button>
                </div>
              </div>
            )}
            {vaccineError && <p className="text-red-500 text-sm mb-3">{vaccineError}</p>}
            {vaccines.length === 0
              ? <div className="card p-10 text-center"><p className="text-gray-400 text-sm">Aucun vaccin enregistré.</p></div>
              : <div className="space-y-3">{vaccines.map(v => (
                  editingVaccineId === v.id ? (
                    <div key={v.id} className="card p-5 border-2 border-sage-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-gray-500">Nom du vaccin *</label><input className="input text-sm mt-1" value={editVaccineForm.name} onChange={e => setEditVaccineForm(f => ({...f, name: e.target.value}))} /></div>
                        <div><label className="text-xs text-gray-500">Date administration *</label><input type="date" className="input text-sm mt-1" value={editVaccineForm.date_administered} onChange={e => setEditVaccineForm(f => ({...f, date_administered: e.target.value}))} /></div>
                        <div><label className="text-xs text-gray-500">Prochain rappel</label><input type="date" className="input text-sm mt-1" value={editVaccineForm.next_due_date} onChange={e => setEditVaccineForm(f => ({...f, next_due_date: e.target.value}))} /></div>
                        <div><label className="text-xs text-gray-500">Administré par</label><input className="input text-sm mt-1" value={editVaccineForm.administered_by} onChange={e => setEditVaccineForm(f => ({...f, administered_by: e.target.value}))} /></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={submitEditVaccine} disabled={updateVaccine.isPending} className="btn-primary text-sm">
                          {updateVaccine.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditingVaccineId(null)} className="btn-secondary text-sm">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div key={v.id} className="card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg">💉</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">{v.name}</p>
                        <p className="text-xs text-gray-500">Le {format(new Date(v.date_administered), 'd MMM yyyy', { locale: fr })}{v.administered_by ? ` · ${v.administered_by}` : ''}</p>
                      </div>
                      {v.next_due_date && <div className="text-right"><p className="text-xs text-amber-600 font-medium">Rappel</p><p className="text-xs text-gray-500">{format(new Date(v.next_due_date), 'd MMM yyyy', { locale: fr })}</p></div>}
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => startEditVaccine(v)} className="text-xs text-sage-600 hover:underline">✏️</button>
                        <button onClick={() => removeVaccine(v)} disabled={deleteVaccine.isPending} className="text-xs text-red-400 hover:underline">🗑️</button>
                      </div>
                    </div>
                  )
                ))}</div>
            }
          </div>
        )}

        {tab === 'weight' && (
          <div>
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
            {/* Courbe de poids */}
            {weights.length >= 2 && (
              <div className="card p-5 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Courbe de poids</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weights.map(w => ({
                    date: format(new Date(w.measured_at), 'd MMM', { locale: fr }),
                    poids: w.weight_kg,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" kg" domain={[
                      0,
                      (dataMax: number) => Math.max(dataMax, SPECIES_MAX_WEIGHT[animal.species] ?? 50)
                    ]} />
                    <Tooltip formatter={(v: any) => [`${v} kg`, 'Poids']} />
                    <Line type="monotone" dataKey="poids" stroke="#f2820f" strokeWidth={2} dot={{ fill: '#f2820f', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
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
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">⚖️</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">{w.weight_kg} kg</p>
                        <p className="text-xs text-gray-500">{format(new Date(w.measured_at), 'd MMM yyyy', { locale: fr })}{w.notes ? ` · ${w.notes}` : ''}</p>
                      </div>
                      {i === 0 && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Dernier</span>}
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
          <div>
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
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg">{typeEmoji[r.type] ?? '📋'}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-gray-900">{r.title}</p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{r.type}</span>
                        </div>
                        <p className="text-xs text-gray-500">{format(new Date(r.date), 'd MMM yyyy', { locale: fr })}{r.professional_name ? ` · ${r.professional_name}` : ''}</p>
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
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Documents & photos</h2>
            </div>

            <div className="card p-5 mb-4 border-2 border-sage-200">
              <h3 className="font-semibold text-sm mb-3">Ajouter un document ou une photo</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Description (facultatif)</label>
                  <input className="input text-sm mt-1" value={docLabel}
                    onChange={e => setDocLabel(e.target.value)}
                    placeholder="Ex: Analyse de sang, radio, ordonnance..." />
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
                        ? <img src={d.file_url} className="w-full h-full object-cover" alt={d.file_name} />
                        : '📄'}
                    </a>
                    <div className="flex-1 min-w-0">
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                        className="font-semibold text-sm text-gray-900 hover:underline truncate block">
                        {d.label || d.file_name}
                      </a>
                      <p className="text-xs text-gray-500">
                        {format(new Date(d.created_at), 'd MMM yyyy', { locale: fr })}
                        {d.uploaded_by === user?.id ? ' · Ajouté par vous' : isDoctor ? ' · Ajouté par le propriétaire' : ' · Ajouté par le praticien'}
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
    </div>
  )
}
