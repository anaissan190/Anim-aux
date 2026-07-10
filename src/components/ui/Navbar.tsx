// src/components/ui/Navbar.tsx
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  const dashboardPath =
    user?.role === 'doctor' ? '/dashboard/doctor' :
    user?.role === 'admin'  ? '/dashboard/admin'  :
    '/dashboard/patient'

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-sage-600">
          <span className="text-2xl">🌿</span>
          <span>Animéaux</span>
        </Link>

        {/* Pour le praticien, ces liens font double emploi avec les onglets
            de son dashboard (Accueil/Mon espace, Messages, Mon profil) —
            on ne les affiche donc que pour les autres rôles. */}
        {user?.role !== 'doctor' && (
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/search" className="hover:text-sage-600 transition-colors">Trouver un praticien</Link>
            {user && <Link to={dashboardPath} className="hover:text-sage-600 transition-colors">Mon espace</Link>}
            {user && <Link to="/messages" className="hover:text-sage-600 transition-colors">Messages</Link>}
            {user && <Link to="/profil" className="hover:text-sage-600 transition-colors">Profil</Link>}
          </div>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              <div className="flex items-center gap-2">
                <Link to="/profil" title="Mon profil" className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-medium text-sm hover:bg-sage-200 transition-colors">
                  {profile?.first_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </Link>
                <button onClick={() => signOut().then(() => navigate('/'))}
                  className="text-sm text-gray-500 hover:text-red-500 transition-colors hidden md:block">
                  Déconnexion
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary text-sm py-2">Connexion</Link>
              <Link to="/register" className="btn-primary text-sm py-2">S'inscrire</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
