// src/pages/PatientDashboard.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import AppointmentCard from '@/components/appointment/AppointmentCard'
import { usePatientAppointments, useAnimals, useCreateAnimal } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { isFuture, isPast } from 'date-fns'
import { SPECIES_EMOJI, BREED_PLACEHOLDER, SPECIES_MAX_WEIGHT } from '@/lib/animalSpecies'
import SpeciesSelect from '@/components/ui/SpeciesSelect'

export default function PatientDashboard() {
  const { profile } = useAuthStore()
  const { data: appointments = [], isLoading } = usePatientAppointments()
  const { data: animals = [] } = useAnimals()
  const createAnimal = useCreateAnimal()

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [showAnimalForm, setShowAnimalForm] = useState(false)
  const [animalForm, setAnimalForm] = useState({
    name: '', species: 'Chien', breed: '', gender: '', date_of_birth: '', microchip_number: '', tattoo_number: '', avatar_url: ''
  })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [animalError, setAnimalError] = useState('')

  const upcoming = appointments.filter(a => isFuture(new Date(a.start_at)) && a.status !== 'cancelled')
  const past = appointments.filter(a => isPast(new Date(a.start_at)) || a.status === 'cancelled')
  const display = tab === 'upcoming' ? upcoming : past

  const speciesEmoji = SPECIES_EMOJI
  const breedPlaceholder = BREED_PLACEHOLDER

  async function uploadAnimalPhoto(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `animals/${Date.now()}.${ext}`
    const { supabase } = await import('@/lib/supabase')
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    )
    const { error } = await Promise.race([
      supabase.storage.from('avatars').upload(path, file, { upsert: true }),
      timeout,
    ])
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function submitAnimal() {
    if (!animalForm.name || !animalForm.species) return
    setAnimalError('')

    // La photo n'est envoyée qu'au moment d'enregistrer (pas à la sélection),
    // pour ne jamais bloquer l'utilisateur pendant qu'il remplit le formulaire.
    let avatarUrl = animalForm.avatar_url || undefined
    if (photoFile) {
      setPhotoUploading(true)
      try {
        const url = await uploadAnimalPhoto(photoFile)
        if (url) avatarUrl = url
        else setAnimalError("La photo n'a pas pu être envoyée, l'animal a été enregistré sans elle.")
      } catch {
        setAnimalError("La photo n'a pas pu être envoyée, l'animal a été enregistré sans elle.")
      } finally {
        setPhotoUploading(false)
      }
    }

    try {
      await createAnimal.mutateAsync({
        ...animalForm,
        // Les champs facultatifs vides doivent partir en NULL, pas en chaîne
        // vide : une chaîne vide peut heurter une contrainte d'unicité ou de
        // format sur microchip_number et faire échouer l'enregistrement.
        breed: animalForm.breed || undefined,
        gender: animalForm.gender || undefined,
        date_of_birth: animalForm.date_of_birth || undefined,
        microchip_number: animalForm.microchip_number || undefined,
        tattoo_number: animalForm.tattoo_number || undefined,
        avatar_url: avatarUrl,
      })
      setAnimalForm({ name: '', species: 'Chien', breed: '', gender: '', date_of_birth: '', microchip_number: '', tattoo_number: '', avatar_url: '' })
      setPhotoPreview(null)
      setPhotoFile(null)
      setShowAnimalForm(false)
    } catch (e: any) {
      setAnimalError(e.message ?? "Erreur lors de l'enregistrement de l'animal.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Bienvenue */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {profile?.first_name ?? 'Patient'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos animaux et vos rendez-vous.</p>
        </div>

        {/* Mes animaux */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">🐾 Mes animaux</h2>
            <button onClick={() => setShowAnimalForm(true)} className="btn-primary text-sm">+ Ajouter</button>
          </div>

          {showAnimalForm && (
            <div className="card p-5 mb-4 border-2 border-sage-200">
              <h3 className="font-semibold text-sm mb-4">Nouvel animal</h3>

              {/* Photo de profil */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {photoPreview
                    ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                    : <span className="text-3xl">{speciesEmoji[animalForm.species] ?? '🐾'}</span>
                  }
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Photo de profil</label>
                  <label className="cursor-pointer btn-secondary text-xs px-3 py-1.5 inline-block">
                    Choisir une photo
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        // Aperçu local instantané uniquement : la photo n'est
                        // envoyée qu'à l'enregistrement (voir submitAnimal).
                        setPhotoPreview(URL.createObjectURL(file))
                        setPhotoFile(file)
                        setAnimalError('')
                      }} />
                  </label>
                  {photoPreview && (
                    <button onClick={() => { setPhotoPreview(null); setPhotoFile(null); setAnimalForm(f => ({ ...f, avatar_url: '' })) }}
                      className="text-xs text-red-400 hover:text-red-500 ml-2">Supprimer</button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Nom *</label>
                  <input className="input text-sm mt-1" value={animalForm.name}
                    onChange={e => setAnimalForm(f => ({...f, name: e.target.value}))}
                    placeholder="Ex: Luna" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Espèce *</label>
                  <SpeciesSelect value={animalForm.species}
                    onChange={species => setAnimalForm(f => ({...f, species, breed: ''}))} />
                </div>
                {animalForm.species === 'Autre' && (
                  <div>
                    <label className="text-xs text-gray-500">Précisez l'espèce *</label>
                    <input className="input text-sm mt-1"
                      placeholder="Ex: Axolotl, Wallaby..."
                      onChange={e => setAnimalForm(f => ({...f, species: e.target.value || 'Autre'}))} />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500">Race</label>
                  <input className="input text-sm mt-1" value={animalForm.breed}
                    onChange={e => setAnimalForm(f => ({...f, breed: e.target.value}))}
                    placeholder={breedPlaceholder[animalForm.species] ?? 'Ex: ...'} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Genre</label>
                  <select className="input text-sm mt-1" value={animalForm.gender}
                    onChange={e => setAnimalForm(f => ({...f, gender: e.target.value}))}>
                    <option value="">Non renseigné</option>
                    <option>Mâle</option>
                    <option>Femelle</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Date de naissance</label>
                  <input type="date" className="input text-sm mt-1" value={animalForm.date_of_birth}
                    onChange={e => setAnimalForm(f => ({...f, date_of_birth: e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">N° puce électronique</label>
                  <input className="input text-sm mt-1" value={animalForm.microchip_number}
                    onChange={e => setAnimalForm(f => ({...f, microchip_number: e.target.value}))}
                    placeholder="Ex: 250268500000000" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">N° de tatouage</label>
                  <input className="input text-sm mt-1" value={animalForm.tattoo_number}
                    onChange={e => setAnimalForm(f => ({...f, tattoo_number: e.target.value}))}
                    placeholder="Si l'animal n'est pas pucé" />
                </div>
              </div>
              {animalError && (
                <p className="text-red-500 text-sm mt-3">{animalError}</p>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={submitAnimal} disabled={createAnimal.isPending || photoUploading}
                  className="btn-primary text-sm">
                  {photoUploading ? 'Envoi de la photo...' : createAnimal.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button onClick={() => { setShowAnimalForm(false); setPhotoPreview(null); setPhotoFile(null); setAnimalError('') }}
                  className="btn-secondary text-sm">Annuler</button>
              </div>
            </div>
          )}

          {animals.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">🐾</div>
              <p className="text-gray-500 text-sm">Aucun animal enregistré. Ajoutez votre premier compagnon !</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {animals.map(a => (
                <Link key={a.id} to={`/animal/${a.id}`}
                  className="card p-4 text-center hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 rounded-xl mx-auto mb-2 overflow-hidden bg-gray-100 flex items-center justify-center">
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                      : <span className="text-3xl">{speciesEmoji[a.species] ?? '🐾'}</span>
                    }
                  </div>
                  <p className="font-semibold text-sm text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.breed ?? a.species}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <Link to="/search" className="card p-4 text-center hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-sm font-medium text-gray-700">Nouveau RDV</p>
          </Link>
          <Link to="/messages" className="card p-4 text-center hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm font-medium text-gray-700">Messages</p>
          </Link>
          <div className="card p-4 text-center opacity-60 cursor-not-allowed">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm font-medium text-gray-700">Ordonnances</p>
            <p className="text-xs text-gray-400">Bientôt</p>
          </div>
        </div>

        {/* Onglets RDV */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
          {(['upcoming', 'past'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
              {t === 'upcoming' ? `À venir (${upcoming.length})` : `Passés (${past.length})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 flex gap-4 animate-pulse">
                <div className="w-14 h-16 bg-gray-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : display.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-4">{tab === 'upcoming' ? '📅' : '📂'}</div>
            <p className="font-medium text-gray-700 mb-2">
              {tab === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
            </p>
            {tab === 'upcoming' && (
              <Link to="/search" className="btn-primary inline-block mt-2 text-sm">
                Prendre un rendez-vous
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {display.map(a => <AppointmentCard key={a.id} appointment={a as any} />)}
          </div>
        )}
      </div>
    </div>
  )
}
