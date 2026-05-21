import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
const { user, profile, signOut } = useAuthStore()

const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav style={{ background: 'white', borderBottom: '1.5px solid #FED7AA', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
      
      {/* LOGO */}
      <div onClick={() => navigate('/')} style={{ fontFamily: 'Fredoka One, cursive', fontSize: '24px', color: '#C2410C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        Animéaux 🐾
      </div>

      {/* LIENS */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <span
          onClick={() => navigate('/search')}
          style={{ fontSize: '14px', fontWeight: 700, color: location.pathname === '/search' ? '#F97316' : '#92400E', cursor: 'pointer' }}>
          Trouver un praticien
        </span>

        {user && (
          <span
            onClick={() => navigate(`/dashboard/${user.role}`)}
            style={{ fontSize: '14px', fontWeight: 700, color: location.pathname.includes('/dashboard') ? '#F97316' : '#92400E', cursor: 'pointer' }}>
            Mon espace
          </span>
        )}

        {user && (
          <span
            onClick={() => navigate('/messages')}
            style={{ fontSize: '14px', fontWeight: 700, color: location.pathname === '/messages' ? '#F97316' : '#92400E', cursor: 'pointer' }}>
            Messages
          </span>
        )}
      </div>

      {/* DROITE */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {user ? (
          <>
            <NotificationBell />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFEDD5', border: '2px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', color: '#C2410C' }}>
                {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
                {profile?.first_name || 'Mon compte'}
              </span>
            </div>
            <button onClick={handleLogout} style={{ background: 'transparent', color: '#92400E', border: '1.5px solid #FED7AA', borderRadius: '10px', padding: '8px 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <span onClick={() => navigate('/login')} style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', cursor: 'pointer' }}>
              Connexion
            </span>
            <button onClick={() => navigate('/register')} style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
              Inscription
            </button>
          </>
        )}
      </div>
    </nav>
  )
}