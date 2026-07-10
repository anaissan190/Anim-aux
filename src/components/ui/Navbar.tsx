// src/components/ui/Navbar.tsx
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'
import { DOCTOR_TABS } from '@/lib/doctorDashboardTabs'

export default function Navbar() {
  const { user, signOut } = useAuthStore()
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
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
            {DOCTOR_TABS.map(t => (
              <Link key={t.id} to={`/dashboard/doctor?tab=${t.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                  ${onDoctorDashboard && activeDoctorTab === t.id
                    ? 'bg-sage-500 text-white'
                    : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
                <span>{t.icon}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Propriétaire d'animal (et admin) : mêmes catégories directement à
            la suite du logo, dans le même style que le praticien. Messages
            et Profil sont gérés plus loin, en icônes à côté de la cloche. */}
        {user && user.role !== 'doctor' && (
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
            <Link to="/search"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                ${location.pathname === '/search'
                  ? 'bg-sage-500 text-white'
                  : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
              <span>🔍</span>
              <span className="hidden lg:inline">Trouver un praticien</span>
            </Link>
            <Link to={dashboardPath}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                ${location.pathname === dashboardPath
                  ? 'bg-sage-500 text-white'
                  : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
              <span>🏠</span>
              <span className="hidden lg:inline">Mon espace</span>
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          {user ? (
            <>
              {/* Accès rapide Messages à côté de la cloche, pour tous les
                  rôles — même traitement que le praticien. */}
              <Link to={user.role === 'doctor' ? '/dashboard/doctor?tab=messages' : '/messages'} title="Messages"
                className="p-2 rounded-xl hover:bg-gray-50 transition-colors text-lg leading-none">
                ✉️
              </Link>
              <NotificationBell />
              <div className="flex items-center gap-2">
                <Link to={user.role === 'doctor' ? '/dashboard/doctor?tab=profil' : '/profil'} title="Mon profil"
                  className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-lg hover:bg-sage-200 transition-colors">
                  👤
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
