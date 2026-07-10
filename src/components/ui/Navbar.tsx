// src/components/ui/Navbar.tsx
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'
import { DOCTOR_TABS } from '@/lib/doctorDashboardTabs'

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const dashboardPath =
    user?.role === 'doctor' ? '/dashboard/doctor' :
    user?.role === 'admin'  ? '/dashboard/admin'  :
    '/dashboard/patient'

  // Onglet actif du dashboard praticien, dérivé directement de l'URL — pour
  // pouvoir surligner le bon onglet ici, dans la Navbar.
  const onDoctorDashboard = user?.role === 'doctor' && location.pathname === '/dashboard/doctor'
  const activeDoctorTab = searchParams.get('tab') || 'home'

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2">
        {/* Le logo ramène toujours vers la page d'accueil publique (recherche
            de praticien, etc.) — même connecté. Pour revenir à son dashboard,
            le praticien a l'onglet "Mon espace" juste à côté. */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-sage-600 flex-shrink-0">
          <span className="text-2xl">🌿</span>
          <span className="hidden sm:inline">Animéaux</span>
        </Link>

        {/* Praticien : les catégories du dashboard (Accueil, Mes patients,
            Tarifs, Disponibilités, Avis) sont affichées ici, à la suite du
            logo — visibles dès la page d'accueil, sans clic supplémentaire. */}
        {user?.role === 'doctor' && (
          <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {DOCTOR_TABS.map(t => (
              <Link key={t.id} to={`/dashboard/doctor?tab=${t.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                  ${onDoctorDashboard && activeDoctorTab === t.id
                    ? 'bg-sage-50 text-sage-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <span>{t.icon}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Pour les autres rôles, liens classiques. */}
        {user?.role !== 'doctor' && (
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/search" className="hover:text-sage-600 transition-colors">Trouver un praticien</Link>
            {user && <Link to={dashboardPath} className="hover:text-sage-600 transition-colors">Mon espace</Link>}
            {user && <Link to="/messages" className="hover:text-sage-600 transition-colors">Messages</Link>}
            {user && <Link to="/profil" className="hover:text-sage-600 transition-colors">Profil</Link>}
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          {user ? (
            <>
              {/* Praticien : accès rapide Messages à côté de la cloche, pour
                  libérer de la place dans la barre d'onglets du dashboard. */}
              {user.role === 'doctor' && (
                <Link to="/dashboard/doctor?tab=messages" title="Messages"
                  className="p-2 rounded-xl hover:bg-gray-50 transition-colors text-lg leading-none">
                  ✉️
                </Link>
              )}
              <NotificationBell />
              <div className="flex items-center gap-2">
                {user.role === 'doctor' ? (
                  <Link to="/dashboard/doctor?tab=profil" title="Mon profil"
                    className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-lg hover:bg-sage-200 transition-colors">
                    👤
                  </Link>
                ) : (
                  <Link to="/profil" title="Mon profil" className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-medium text-sm hover:bg-sage-200 transition-colors">
                    {profile?.first_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                  </Link>
                )}
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
