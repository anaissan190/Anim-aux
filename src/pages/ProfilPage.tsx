import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { useCurrentDoctor, useUpdateProfile, useUpdateDoctor } from '@/hooks/useData'
import Navbar from '@/components/ui/Navbar'
import RichTextEditor from '@/components/ui/RichTextEditor'

export default function ProfilPage() {
  const { user, profile } = useAuthStore()
  const { data: doctor } = useCurrentDoctor()
  const updateProfile = useUpdateProfile()
  const updateDoctor = useUpdateDoctor()

  const isDoctor = user?.role === 'doctor'

  // Champs profil
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')

  // Champs praticien
  const [specialty, setSpecialty]   = useState('')
  const [bio, setBio]               = useState('')
  const [city, setCity]             = useState('')
  const [address, setAddress]       = useState('')
  const [price, setPrice]           = useState('')

  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // Préremplir avec les données existantes
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      setPhone(profile.phone || '')
    }
  }, [profile])

  useEffect(() => {
    if (doctor) {
      setSpecialty(doctor.specialty || '')
      setBio(doctor.bio || '')
      setCity(doctor.city || '')
      setAddress(doctor.address || '')
      setPrice(doctor.consultation_price?.toString() || '')
    }
  }, [doctor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    try {
      await updateProfile.mutateAsync({ first_name: firstName, last_name: lastName, phone })
      if (isDoctor) {
        await updateDoctor.mutateAsync({
          specialty,
          bio,
          city,
          address,
          consultation_price: price ? parseInt(price) : undefined,
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            👤 {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : 'Mon profil'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
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
            <div>
              <label className="text-xs text-gray-500">Téléphone</label>
              <input className="input text-sm mt-1" value={phone}
                onChange={e => setPhone(e.target.value)} placeholder="06 00 00 00 00" type="tel" />
            </div>
          </div>

          {/* INFOS PRO (praticiens uniquement) */}
          {isDoctor && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">🩺 Informations professionnelles</h2>
              <div className="mb-3">
                <label className="text-xs text-gray-500">Spécialité / Activité</label>
                <input className="input text-sm mt-1" value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  placeholder="Ex : Toiletteur, Vétérinaire, Palefrenier…" />
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
              <div>
                <label className="text-xs text-gray-500">Adresse</label>
                <input className="input text-sm mt-1" value={address}
                  onChange={e => setAddress(e.target.value)} placeholder="12 rue des Lilas, 75001 Paris" />
              </div>
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
      </div>
    </div>
  )
}
