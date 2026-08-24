// src/pages/AnimalsPage.tsx
// "Mes animaux" — jusqu'ici une section intégrée à PatientDashboard ; devient
// une page à part entière pour servir de destination à la barre de
// navigation mobile (voir MobileTabBar). Logique et formulaire d'ajout
// repris tels quels de PatientDashboard (mêmes hooks, même comportement) —
// seul l'habillage change entre desktop (Navbar classique) et mobile
// (MobileHeader/MobileTabBar).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import AnimalBackground from '@/components/ui/AnimalBackground'
import MobileHeader from '@/components/mobile/MobileHeader'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import { useAnimals, useCreateAnimal, useWeightTracking, useVaccines } from '@/hooks/useData'
import { SPECIES_EMOJI, BREED_PLACEHOLDER } from '@/lib/animalSpecies'
import SpeciesSelect from '@/components/ui/SpeciesSelect'
import { format, differenceInYears } from 'date-fns'
import { fr } from 'date-fns/locale'

const GENDER_SYMBOL: Record<string, string> = { 'Mâle': '♂', 'Femelle': '♀' }

// Rangée d'un animal sur mobile, avec pastilles poids/vaccin — chaque
// rangée porte ses propres requêtes (peu de risque de perf avec 1-3 animaux
// par foyer), pour ne pas alourdir useAnimals() côté liste.
function PetRow({ animal, index }: { animal: any; index: number }) {
  const { data: weights = [] } = useWeightTracking(animal.id)
  const { data: vaccines = [] } = useVaccines(animal.id)
  const latestWeight = weights[weights.length - 1]
  const upcomingVaccine = vaccines.find((v: any) => v.next_due_date && new Date(v.next_due_date) > new Date())
  // Distinct d'un simple "pas de rappel à venir" : un rappel dont la date
  // est déjà passée affichait "✅ À jour" (upcomingVaccine ne le matchait
  // pas, faute de filtre séparé), donnant une fausse impression de sécurité.
  const overdueVaccine = vaccines.find((v: any) => v.next_due_date && new Date(v.next_due_date) <= new Date())
  const hasVaccineHistory = vaccines.length > 0

  const age = animal.date_of_birth ? differenceInYears(new Date(), new Date(animal.date_of_birth)) : null
  const genderSymbol = GENDER_SYMBOL[animal.gender as string]

  return (
    <Link to={`/animal/${animal.id}`}
      className="block bg-white/90 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm border border-white/70 animate-rise-in"
      style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="h-24 bg-sage-100 flex items-center justify-center">
        {animal.avatar_url
          ? <img src={animal.avatar_url} alt={animal.name} className="w-full h-full object-cover" />
          : <span className="text-4xl">{SPECIES_EMOJI[animal.species] ?? '🐾'}</span>
        }
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-fredoka font-semibold text-[15px] text-gray-900 truncate">
            {animal.name}{genderSymbol ? ` ${genderSymbol}` : ''}
          </p>
          {age !== null && <p className="text-[10.5px] font-bold text-gray-500 flex-shrink-0">{age} an{age > 1 ? 's' : ''}</p>}
        </div>
        <p className="text-[11.5px] font-bold text-gray-500 mb-1.5">{animal.breed ?? animal.species}</p>
        <div className="flex gap-1.5 flex-wrap">
          {latestWeight && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-moss-100 text-moss-800">
              ⚖️ {latestWeight.weight_kg} kg
            </span>
          )}
          {overdueVaccine ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              ⚠️ Rappel en retard
            </span>
          ) : upcomingVaccine ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              💉 {format(new Date(upcomingVaccine.next_due_date), 'd MMM', { locale: fr })}
            </span>
          ) : hasVaccineHistory ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-moss-100 text-moss-800">
              ✅ À jour
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export default function AnimalsPage() {
  const { data: animals = [] } = useAnimals()
  const createAnimal = useCreateAnimal()

  const [showAnimalForm, setShowAnimalForm] = useState(false)
  const [animalForm, setAnimalForm] = useState({
    name: '', species: 'Chien', breed: '', gender: '', date_of_birth: '', microchip_number: '', tattoo_number: '', avatar_url: ''
  })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [animalError, setAnimalError] = useState('')

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

  const addAnimalForm_ = (
    <>
      {showAnimalForm && (
        <div className="card p-5 mb-4 border-2 border-sage-200">
          <h3 className="font-semibold text-sm mb-4">Nouvel animal</h3>
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
                onChange={e => setAnimalForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Luna" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Espèce *</label>
              <SpeciesSelect value={animalForm.species}
                onChange={species => setAnimalForm(f => ({ ...f, species, breed: '' }))} />
            </div>
            {animalForm.species === 'Autre' && (
              <div>
                <label className="text-xs text-gray-500">Précisez l'espèce *</label>
                <input className="input text-sm mt-1"
                  placeholder="Ex: Axolotl, Wallaby..."
                  onChange={e => setAnimalForm(f => ({ ...f, species: e.target.value || 'Autre' }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Race</label>
              <input className="input text-sm mt-1" value={animalForm.breed}
                onChange={e => setAnimalForm(f => ({ ...f, breed: e.target.value }))}
                placeholder={breedPlaceholder[animalForm.species] ?? 'Ex: ...'} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Genre</label>
              <select className="input text-sm mt-1" value={animalForm.gender}
                onChange={e => setAnimalForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">Non renseigné</option>
                <option>Mâle</option>
                <option>Femelle</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Date de naissance</label>
              <input type="date" className="input text-sm mt-1" value={animalForm.date_of_birth}
                onChange={e => setAnimalForm(f => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">N° puce électronique</label>
              <input className="input text-sm mt-1" value={animalForm.microchip_number}
                onChange={e => setAnimalForm(f => ({ ...f, microchip_number: e.target.value }))}
                placeholder="Ex: 250268500000000" />
            </div>
            <div>
              <label className="text-xs text-gray-500">N° de tatouage</label>
              <input className="input text-sm mt-1" value={animalForm.tattoo_number}
                onChange={e => setAnimalForm(f => ({ ...f, tattoo_number: e.target.value }))}
                placeholder="Si l'animal n'est pas pucé" />
            </div>
          </div>
          {animalError && <p className="text-red-500 text-sm mt-3">{animalError}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={submitAnimal} disabled={createAnimal.isPending || photoUploading} className="btn-primary text-sm">
              {photoUploading ? 'Envoi de la photo...' : createAnimal.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => { setShowAnimalForm(false); setPhotoPreview(null); setPhotoFile(null); setAnimalError('') }}
              className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      )}
    </>
  )

  const desktopAnimalsGrid_ = animals.length === 0 ? (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-3">🐾</div>
      <p className="text-gray-500 text-sm">Aucun animal enregistré. Ajoutez votre premier compagnon !</p>
    </div>
  ) : (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {animals.map(a => (
        <Link key={a.id} to={`/animal/${a.id}`} className="card p-4 text-center hover:shadow-md transition-shadow">
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
  )

  // Mobile : liste de rangées horizontales (avatar + nom/race + chevron),
  // reprenant exactement la structure de l'écran "Animaux" de l'aperçu
  // validé — pas une grille 2 colonnes de cartes centrées.
  const mobileAnimalsGrid_ = animals.length === 0 ? (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-8 text-center shadow-sm border border-white/70">
      <div className="text-4xl mb-3">🐾</div>
      <p className="text-gray-500 text-sm">Aucun animal enregistré. Ajoutez votre premier compagnon !</p>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {animals.map((a, i) => <PetRow key={a.id} animal={a} index={i} />)}
    </div>
  )

  return (
    <div className="relative min-h-screen bg-sage-50">
      <div className="relative z-10">

        {/* Desktop : inchangé */}
        <div className="hidden md:block">
          <AnimalBackground />
          <Navbar />
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">🐾 Mes animaux</h1>
              <button onClick={() => setShowAnimalForm(true)} className="btn-primary text-sm">+ Ajouter</button>
            </div>
            {addAnimalForm_}
            {desktopAnimalsGrid_}
          </div>
        </div>

        {/* Mobile : coquille "Wow / Aurora" */}
        <div className="md:hidden pb-24 min-h-screen bg-[#FFE9C8]">
          <MobileHeader className="bg-sage-100/60">
            <h1 className="font-fredoka text-2xl font-semibold text-gray-900">Mes animaux</h1>
            <p className="font-nunito text-sm text-gray-500 mt-0.5">Carnet de santé & rappels</p>
          </MobileHeader>
          <div className="px-4 -mt-1">
            <button onClick={() => setShowAnimalForm(true)}
              className="w-full font-fredoka font-semibold text-sm bg-sage-500 text-white rounded-2xl py-3 mb-4 shadow-sm">
              + Ajouter un animal
            </button>
            {addAnimalForm_}
            {mobileAnimalsGrid_}
          </div>
          <MobileTabBar />
        </div>
      </div>
    </div>
  )
}
