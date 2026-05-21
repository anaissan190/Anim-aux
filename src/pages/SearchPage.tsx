import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDoctors } from '@/hooks/useData'

const SPECIALTIES = [
  'Tous',
  'Vétérinaire généraliste',
  'Vétérinaire urgentiste',
  'Toiletteur',
  'Ostéopathe animalier',
  'Comportementaliste animalier',
  'Nutritionniste animalier',
  'Dentiste vétérinaire',
  'Éducateur canin',
]

export default function SearchPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [specialty, setSpecialty] = useState('Tous')
  const { data: doctors = [] } = useDoctors()

  const filtered = doctors.filter(d => {
    const matchSearch = search === '' ||
      `${d.profiles?.first_name} ${d.profiles?.last_name}`.toLowerCase().includes(search.toLowerCase())
    const matchCity = city === '' || d.city?.toLowerCase().includes(city.toLowerCase())
    const matchSpec = specialty === 'Tous' || d.specialty === specialty
    return matchSearch && matchCity && matchSpec
  })

  const specIcon = (spec: string) => {
    if (spec?.includes('Vétérinaire')) return '🩺'
    if (spec?.includes('Toiletteur')) return '✂️'
    if (spec?.includes('Ostéopathe')) return '🖐️'
    if (spec?.includes('Comportementaliste')) return '🧠'
    if (spec?.includes('Nutritionniste')) return '🥗'
    if (spec?.includes('Dentiste')) return '🦷'
    if (spec?.includes('Éducateur')) return '🎓'
    return '🐾'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFBF5', fontFamily: 'Nunito, sans-serif' }}>

      {/* HEADER RECHERCHE */}
      <div style={{ background: '#FFF7ED', borderBottom: '1.5px solid #FED7AA', padding: '24px 40px' }}>
        <h1 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '28px', color: '#C2410C', marginBottom: '16px' }}>
          Trouver un praticien 🐾
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', background: 'white', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom du praticien..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#1C0A00', fontFamily: 'Nunito, sans-serif', background: 'transparent' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '160px', background: 'white', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>📍</span>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ville..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#1C0A00', fontFamily: 'Nunito, sans-serif', background: 'transparent' }}
            />
          </div>
        </div>

        {/* FILTRES SPÉCIALITÉS */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          {SPECIALTIES.map(s => (
            <button key={s} onClick={() => setSpecialty(s)}
              style={{ background: specialty === s ? '#F97316' : 'white', color: specialty === s ? 'white' : '#C2410C', border: `1.5px solid ${specialty === s ? '#F97316' : '#FED7AA'}`, borderRadius: '999px', padding: '6px 14px', fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* RÉSULTATS */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', marginBottom: '20px' }}>
          {filtered.length} praticien{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#92400E' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p style={{ fontWeight: 700, fontSize: '16px' }}>Aucun praticien trouvé</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Essayez une autre spécialité ou ville</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filtered.map(doctor => (
              <div key={doctor.id}
                style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => navigate(`/doctor/${doctor.id}`)}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>

                {/* AVATAR */}
                <div style={{ width: '64px', height: '64px', background: '#FFEDD5', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
                  {specIcon(doctor.specialty)}
                </div>

                {/* INFOS */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: '17px', color: '#1C0A00', marginBottom: '2px' }}>
                    {doctor.profiles?.first_name} {doctor.profiles?.last_name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#92400E', marginBottom: '8px' }}>
                    {doctor.specialty} · {doctor.city}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {doctor.average_rating && (
                      <span style={{ background: '#FFEDD5', color: '#C2410C', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                        ⭐ {doctor.average_rating}
                      </span>
                    )}
                    <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                      Disponible
                    </span>
                    {doctor.bio && (
                      <span style={{ background: '#FFF7ED', color: '#92400E', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                        {doctor.bio.slice(0, 40)}...
                      </span>
                    )}
                  </div>
                </div>

                {/* PRIX + CTA */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '26px', color: '#F97316', marginBottom: '8px' }}>
                    {doctor.consultation_price}€
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/book/${doctor.id}`) }}
                    style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 18px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                    Prendre RDV
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}