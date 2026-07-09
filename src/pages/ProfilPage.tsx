import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { useCurrentDoctor, useUpdateProfile, useUpdateDoctor } from '@/hooks/useData'
import RichTextEditor from '@/components/ui/RichTextEditor'

export default function ProfilPage() {
  const navigate = useNavigate()
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

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px',
    padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px',
    color: '#1C0A00', outline: 'none', background: '#FFFBF5', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px',
  }
  const sectionStyle: React.CSSProperties = {
    background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px',
    padding: '28px', marginBottom: '20px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '36px 20px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button onClick={() => navigate(-1)} style={{ background: '#FFEDD5', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '16px' }}>
            ←
          </button>
          <div>
            <h1 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '28px', color: '#C2410C', margin: 0 }}>
              Mon profil
            </h1>
            <p style={{ fontSize: '13px', color: '#92400E', margin: 0 }}>
              {user?.email}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* INFOS PERSONNELLES */}
          <div style={sectionStyle}>
            <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '20px', color: '#C2410C', marginBottom: '20px' }}>
              👤 Informations personnelles
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Prénom</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} placeholder="Ton prénom" required />
              </div>
              <div>
                <label style={labelStyle}>Nom</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} placeholder="Ton nom" required />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="06 00 00 00 00" type="tel" />
            </div>
          </div>

          {/* INFOS PRO (praticiens uniquement) */}
          {isDoctor && (
            <div style={sectionStyle}>
              <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '20px', color: '#C2410C', marginBottom: '20px' }}>
                🩺 Informations professionnelles
              </h2>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Spécialité / Activité</label>
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} style={inputStyle} placeholder="Ex : Toiletteur, Vétérinaire, Palefrenier…" />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Bio / Présentation</label>
                <RichTextEditor value={bio} onChange={setBio} placeholder="Décris ton activité, ton expérience…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Ville</label>
                  <input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} placeholder="Paris" />
                </div>
                <div>
                  <label style={labelStyle}>Tarif (€)</label>
                  <input value={price} onChange={e => setPrice(e.target.value)} style={inputStyle} placeholder="50" type="number" min="0" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="12 rue des Lilas, 75001 Paris" />
              </div>
            </div>
          )}

          {/* BOUTON */}
          {success && (
            <div style={{ background: '#DCFCE7', border: '1.5px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#16A34A', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              ✓ Profil mis à jour avec succès !
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: loading ? '#FED7AA' : '#F97316', color: 'white',
            border: 'none', borderRadius: '14px', padding: '14px',
            fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>

        </form>
      </div>
    </div>
  )
}
