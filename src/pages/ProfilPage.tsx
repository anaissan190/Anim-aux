import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { useCurrentDoctor, useUpdateProfile, useUpdateDoctor, useDeleteAccount, useExportMyData } from '@/hooks/useData'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { PRACTITIONER_TYPES, getPractitionerType } from '@/lib/practitionerTypes'
import { PRACTICE_SPECIES_OPTIONS } from '@/lib/animalSpecies'

export default function ProfilPage() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const { data: doctor } = useCurrentDoctor()
  const updateProfile = useUpdateProfile()
  const updateDoctor = useUpdateDoctor()
  const deleteAccount = useDeleteAccount()
  const exportMyData = useExportMyData()
  const [exportError, setExportError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `profiles/${user!.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile.mutateAsync({ avatar_url: data.publicUrl })
    } catch (e: any) {
      setPhotoError(e.message ?? "Erreur lors de l'envoi de la photo.")
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    try {
      await deleteAccount.mutateAsync()
      await signOut()
      navigate('/')
    } catch (e: any) {
      setDeleteError(e.message ?? 'Erreur lors de la suppression du compte.')
    }
  }

  async function handleExportData() {
    setExportError('')
    try {
      const data = await exportMyData.mutateAsync()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `animeaux-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setExportError(e.message ?? "Erreur lors de l'export des données.")
    }
  }

  function closeDeleteModal() {
    setConfirmDelete(false)
    setDeleteConfirmText('')
    setDeleteError('')
  }

  const isDoctor = user?.role === 'doctor'

  // Champs profil
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [emergencyName, setEmergencyName]   = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  // Champs praticien
  const [practitionerTypeId, setPractitionerTypeId] = useState('')
  const [bio, setBio]               = useState('')
  const [city, setCity]             = useState('')
  const [address, setAddress]       = useState('')
  const [price, setPrice]           = useState('')
  const [acceptedSpecies, setAcceptedSpecies] = useState<string[]>([])
  const [homeVisit, setHomeVisit]   = useState(false)

  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // Préremplir avec les données existantes
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      setPhone(profile.phone || '')
      setHomeAddress(profile.address || '')
      setEmergencyName(profile.emergency_contact_name || '')
      setEmergencyPhone(profile.emergency_contact_phone || '')
    }
  }, [profile])

  useEffect(() => {
    if (doctor) {
      const matched = PRACTITIONER_TYPES.find(p => p.label === doctor.specialty)
      setPractitionerTypeId(matched?.id ?? (doctor.specialty ? 'autre' : ''))
      setBio(doctor.bio || '')
      setCity(doctor.city || '')
      setAddress(doctor.address || '')
      setPrice(doctor.consultation_price?.toString() || '')
      setAcceptedSpecies(doctor.accepted_species || [])
      setHomeVisit(doctor.home_visit || false)
    }
  }, [doctor])

  function toggleSpecies(id: string) {
    setAcceptedSpecies(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    try {
      await updateProfile.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        phone,
        address: homeAddress,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
      })
      if (isDoctor) {
        await updateDoctor.mutateAsync({
          specialty: getPractitionerType(practitionerTypeId)?.label ?? '',
          bio,
          city,
          address,
          consultation_price: price ? parseInt(price) : undefined,
          accepted_species: acceptedSpecies,
          home_visit: homeVisit,
        })
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        <BackButton fallback={isDoctor ? '/dashboard/doctor?tab=profil' : '/dashboard/patient'} />

        {/* En-tête */}
        <div className="mb-8 flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0 group">
            <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center text-2xl overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Photo de profil" />
                : '👤'}
            </div>
            <label className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <span className="text-white text-xs font-medium">{photoUploading ? '...' : '📷'}</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />
            </label>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : 'Mon profil'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
            {photoError && <p className="text-red-500 text-xs mt-1">{photoError}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* INFOS PERSONNELLES */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Informations personnelles</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500">Prénom</label>
                <input className="input text-sm mt-1" value={firstName}
                  onChange={e => setFirstName(e.target.value)} placeholder="Ton prénom" required />
              </div>
              <div>
                <label className="text-xs text-gray-500">Nom</label>
                <input className="input text-sm mt-1" value={lastName}
                  onChange={e => setLastName(e.target.value)} placeholder="Ton nom" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input className="input text-sm mt-1 bg-gray-50 text-gray-500" value={user?.email ?? ''}
                  disabled readOnly />
              </div>
              <div>
                <label className="text-xs text-gray-500">Téléphone</label>
                <input className="input text-sm mt-1" value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="06 00 00 00 00" type="tel" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Adresse postale</label>
              <input className="input text-sm mt-1" value={homeAddress}
                onChange={e => setHomeAddress(e.target.value)} placeholder="12 rue des Lilas, 75001 Paris" />
            </div>
          </div>

          {/* CONTACT D'URGENCE */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-1">🚨 Contact d'urgence</h2>
            <p className="text-xs text-gray-400 mb-4">Facultatif — une personne à prévenir en cas d'urgence.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Nom</label>
                <input className="input text-sm mt-1" value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)} placeholder="Ex: Marie Dupont" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Téléphone</label>
                <input className="input text-sm mt-1" value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)} placeholder="06 00 00 00 00" type="tel" />
              </div>
            </div>
          </div>

          {/* INFOS PRO (praticiens uniquement) */}
          {isDoctor && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">🩺 Informations professionnelles</h2>
              <div className="mb-3">
                <label className="text-xs text-gray-500">Spécialité / Activité</label>
                <select className="input text-sm mt-1" value={practitionerTypeId}
                  onChange={e => setPractitionerTypeId(e.target.value)}>
                  <option value="" disabled>Sélectionnez votre profession</option>
                  {PRACTITIONER_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.icon} {type.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Bio / Présentation</label>
                <RichTextEditor value={bio} onChange={setBio} placeholder="Décris ton activité, ton expérience…" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500">Ville</label>
                  <input className="input text-sm mt-1" value={city}
                    onChange={e => setCity(e.target.value)} placeholder="Paris" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tarif (€)</label>
                  <input className="input text-sm mt-1" value={price}
                    onChange={e => setPrice(e.target.value)} placeholder="50" type="number" min="0" />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500">Adresse</label>
                <input className="input text-sm mt-1" value={address}
                  onChange={e => setAddress(e.target.value)} placeholder="12 rue des Lilas, 75001 Paris" />
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1.5">Espèces acceptées</label>
                <div className="flex flex-wrap gap-2">
                  {PRACTICE_SPECIES_OPTIONS.map(opt => (
                    <button type="button" key={opt.id} onClick={() => toggleSpecies(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        acceptedSpecies.includes(opt.id)
                          ? 'bg-sage-500 border-sage-500 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-sage-300'
                      }`}>
                      {opt.icon} {opt.id}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={homeVisit} onChange={e => setHomeVisit(e.target.checked)}
                  className="accent-sage-500 w-4 h-4" />
                🏠 Je me déplace à domicile
              </label>
            </div>
          )}

          {/* BOUTON */}
          {success && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-center text-sm font-medium text-green-600">
              ✓ Profil mis à jour avec succès !
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>

        </form>

        {/* EXPORT DES DONNÉES — droit à la portabilité (RGPD art. 20) */}
        <div className="card p-6 mt-8">
          <h2 className="font-semibold text-gray-900 mb-1">Mes données</h2>
          <p className="text-xs text-gray-500 mb-4">
            Téléchargez une copie de toutes vos données personnelles (profil, animaux, rendez-vous, messages, avis…)
            dans un fichier structuré.
          </p>
          {exportError && <p className="text-red-500 text-xs mb-3">{exportError}</p>}
          <button onClick={handleExportData} disabled={exportMyData.isPending}
            className="btn-secondary text-sm">
            {exportMyData.isPending ? 'Préparation...' : '⬇️ Télécharger mes données'}
          </button>
        </div>

        {/* ZONE DE DANGER */}
        <div className="card p-6 mt-8 border border-red-100">
          <h2 className="font-semibold text-red-600 mb-1">Zone de danger</h2>
          <p className="text-xs text-gray-500 mb-4">
            La suppression de votre compte est définitive : profil, rendez-vous, animaux et dossiers de santé,
            messages, avis{isDoctor ? ', cabinet dont vous êtes le créateur' : ''} — tout sera effacé sans possibilité de retour en arrière.
          </p>
          <button onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:underline font-medium">
            Supprimer mon compte
          </button>
        </div>

        {/* ÉCRAN INTERMÉDIAIRE DE CONFIRMATION — étape de friction volontaire
            avant une action irréversible : oblige à taper "SUPPRIMER" plutôt
            qu'un simple clic de confirmation. */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-4xl mb-3 text-center">⚠️</div>
              <h2 className="text-lg font-bold text-gray-900 text-center mb-2">
                Supprimer définitivement votre compte ?
              </h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                Cette action est <strong>irréversible</strong>. Seront effacés sans retour en arrière :
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-5 bg-red-50 rounded-xl p-4">
                <li>Votre profil et vos informations personnelles</li>
                <li>Tous vos rendez-vous (passés et à venir)</li>
                <li>Vos animaux et leurs dossiers de santé</li>
                <li>Vos messages et avis</li>
                {isDoctor && <li>Le cabinet dont vous êtes le créateur, le cas échéant</li>}
              </ul>
              <label className="text-xs text-gray-500 block mb-1.5">
                Tapez <strong>SUPPRIMER</strong> pour confirmer
              </label>
              <input className="input text-sm mb-4" value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER" autoFocus />
              {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
              <div className="flex gap-2">
                <button onClick={closeDeleteModal} className="btn-secondary flex-1 text-sm py-2">
                  Annuler
                </button>
                <button onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'SUPPRIMER' || deleteAccount.isPending}
                  className="btn-primary bg-red-500 hover:bg-red-600 flex-1 text-sm py-2">
                  {deleteAccount.isPending ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
