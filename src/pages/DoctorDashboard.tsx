import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { useDoctorAppointments } from '@/hooks/useData'

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { data: appointments = [] } = useDoctorAppointments(user?.id)

  const today = new Date()
  const todayAppts = appointments.filter(a => {
    const d = new Date(a.start_at)
    return d.toDateString() === today.toDateString()
  })
  const upcoming = appointments.filter(a => new Date(a.start_at) > today && a.status !== 'cancelled')
  const pending = appointments.filter(a => a.status === 'pending')

  const statusColor = (status: string) => {
    if (status === 'confirmed') return { bg: '#DCFCE7', color: '#16A34A' }
    if (status === 'cancelled') return { bg: '#FEE2E2', color: '#DC2626' }
    if (status === 'completed') return { bg: '#E0F2FE', color: '#0369A1' }
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
              Bonjour Dr. {profile?.last_name || ''} 👋
            </h1>
            <p style={{ fontSize: '14px', color: '#92400E' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => navigate('/messages')}
            style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: '14px', padding: '14px 24px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: '15px', cursor: 'pointer' }}>
            💬 Messages
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { n: todayAppts.length, l: "Aujourd'hui", icon: '📅' },
            { n: upcoming.length, l: 'À venir', icon: '🗓️' },
            { n: pending.length, l: 'En attente', icon: '⏳' },
            { n: appointments.length, l: 'Total RDV', icon: '📊' },
          ].map(k => (
            <div key={k.l} style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '26px', marginBottom: '6px' }}>{k.icon}</div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '32px', color: '#F97316' }}>{k.n}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* RDV AUJOURD'HUI */}
        <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#C2410C', marginBottom: '16px' }}>
            Aujourd'hui 📅
          </h2>
          {todayAppts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#92400E' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
              <p style={{ fontWeight: 700 }}>Aucun rendez-vous aujourd'hui</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todayAppts.map(appt => (
                <div key={appt.id} style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', background: '#FFEDD5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      🐾
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: '#1C0A00' }}>
                        {appt.profiles?.first_name} {appt.profiles?.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#92400E' }}>
                        🕐 {new Date(appt.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {appt.reason && ` · ${appt.reason}`}
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

        {/* PROCHAINS RDV */}
        <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#C2410C', marginBottom: '16px' }}>
            Prochains rendez-vous 🗓️
          </h2>
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#92400E' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📭</div>
              <p style={{ fontWeight: 700 }}>Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcoming.slice(0, 8).map(appt => (
                <div key={appt.id} style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', background: '#FFEDD5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      🐾
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: '#1C0A00' }}>
                        {appt.profiles?.first_name} {appt.profiles?.last_name}
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

        {/* EN ATTENTE */}
        {pending.length > 0 && (
          <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '24px' }}>
            <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#C2410C', marginBottom: '16px' }}>
              En attente de confirmation ⏳
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pending.map(appt => (
                <div key={appt.id} style={{ background: '#FFFBF5', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', background: '#FFEDD5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🐾</div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: '#1C0A00' }}>
                        {appt.profiles?.first_name} {appt.profiles?.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#92400E' }}>
                        📅 {new Date(appt.start_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(appt.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ background: '#DCFCE7', color: '#16A34A', border: 'none', borderRadius: '8px', padding: '6px 12px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}>
                      ✓ Confirmer
                    </button>
                    <button style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '8px', padding: '6px 12px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}>
                      ✗ Refuser
                    </button>
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