import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { usePatientAppointments, useAnimals } from '@/hooks/useData'

export default function PatientDashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
const { data: appointments = [] } = usePatientAppointments()
const { data: animals = [] } = useAnimals()

  const upcoming = appointments.filter(a => a.status !== 'cancelled' && new Date(a.start_at) > new Date())
  const past = appointments.filter(a => new Date(a.start_at) < new Date())

  const statusColor = (status: string) => {
    if (status === 'confirmed') return { bg: '#DCFCE7', color: '#16A34A' }
    if (status === 'cancelled') return { bg: '#FEE2E2', color: '#DC2626' }
    return { bg: '#FFEDD5', color: '#C2410C' }
  }

  const statusLabel = (status: string) => {
    if (status === 'confirmed') return 'Confirmé'
    if (status === 'cancelled') return 'Annulé'
    if (status === 'completed') return 'Terminé'
    return 'En attente'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '36px', color: '#C2410C', marginBottom: '4px' }}>
              Bonjour {profile?.first_name || 'là'} 👋
            </h1>
            <p style={{ fontSize: '14px', color: '#92400E' }}>Bienvenue sur votre espace Animéaux 🐾</p>
          </div>
          <button onClick={() => navigate('/search')} style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: '14px', padding: '14px 24px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: '15px', cursor: 'pointer' }}>
            + Prendre RDV
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { n: animals.length, l: 'Mes animaux', icon: '🐾' },
            { n: upcoming.length, l: 'Prochains RDV', icon: '📅' },
            { n: past.length, l: 'Consultations passées', icon: '✅' },
          ].map(k => (
            <div key={k.l} style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{k.icon}</div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '32px', color: '#F97316' }}>{k.n}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* MES ANIMAUX */}
        <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#C2410C' }}>Mes animaux 🐾</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {animals.map(animal => (
              <div key={animal.id} onClick={() => navigate(`/animal/${animal.id}`)}
                style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                  {animal.species === 'chat' ? '🐱' : animal.species === 'chien' ? '🐶' : animal.species === 'lapin' ? '🐇' : animal.species === 'oiseau' ? '🐦' : '🐾'}
                </div>
                <div style={{ fontWeight: 900, fontSize: '14px', color: '#C2410C' }}>{animal.name}</div>
                <div style={{ fontSize: '11px', color: '#92400E', marginTop: '2px' }}>{animal.species}</div>
              </div>
            ))}
            <div onClick={() => {}} style={{ background: '#FFFBF5', border: '1.5px dashed #FED7AA', borderRadius: '14px', padding: '16px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
              <div style={{ fontSize: '24px', color: '#F97316' }}>+</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#92400E', marginTop: '4px' }}>Ajouter</div>
            </div>
          </div>
        </div>

        {/* PROCHAINS RDV */}
        <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#C2410C', marginBottom: '16px' }}>Prochains rendez-vous 📅</h2>
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#92400E' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📭</div>
              <p style={{ fontWeight: 700 }}>Aucun rendez-vous à venir</p>
              <button onClick={() => navigate('/search')} style={{ marginTop: '12px', background: '#F97316', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
                Prendre un RDV
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcoming.map(appt => (
                <div key={appt.id} style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', background: '#FFEDD5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🩺</div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: '#1C0A00' }}>
                        {appt.doctors?.profiles?.first_name} {appt.doctors?.profiles?.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#92400E' }}>
                        📅 {new Date(appt.start_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(appt.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...statusColor(appt.status), borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>
                    {statusLabel(appt.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RDV PASSÉS */}
        {past.length > 0 && (
          <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '24px' }}>
            <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#C2410C', marginBottom: '16px' }}>Historique 📋</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {past.slice(0, 5).map(appt => (
                <div key={appt.id} style={{ background: '#F9F9F9', border: '1.5px solid #F3F4F6', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', background: '#F3F4F6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🩺</div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: '#1C0A00' }}>
                        {appt.doctors?.profiles?.first_name} {appt.doctors?.profiles?.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#92400E' }}>
                        {new Date(appt.start_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...statusColor(appt.status), borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>
                    {statusLabel(appt.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}