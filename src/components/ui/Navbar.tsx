// src/components/ui/Navbar.tsx
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'
import { DOCTOR_TABS } from '@/lib/doctorDashboardTabs'
import { useConversationPartners, useMyClinicStaffInfo } from '@/hooks/useData'
import logoNavbar from '@/assets/logo-navbar.svg'

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isHome = location.pathname === '/'

  // Sur l'accueil uniquement : barre épaisse tout en haut (logo bien visible
  // au premier coup d'œil), qui rétrécit progressivement dès qu'on scroll.
  // Sur les autres pages, la barre garde sa taille compacte habituelle.
  const [scrolled, setScrolled] = useState(!isHome)
  useEffect(() => {
    if (!isHome) { setScrolled(true); return }
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  const big = isHome && !scrolled

  // Pastille rouge sur l'enveloppe : les nouveaux messages ont leur propre
  // indicateur, séparé de la cloche de notifications (qui sert désormais
  // aux autres mises à jour : RDV confirmé/annulé, avis, etc.).
  const { data: conversationPartners = [] } = useConversationPartners()
  const unreadMessages = conversationPartners.reduce((sum, p) => sum + (p.unread_count || 0), 0)
  const { data: staffInfo } = useMyClinicStaffInfo()

  const dashboardPath =
    user?.role === 'doctor'    ? '/dashboard/doctor' :
    user?.role === 'admin'     ? '/dashboard/admin'  :
    user?.role === 'secretary' ? '/dashboard/secretariat' :
    '/dashboard/patient'

  // Onglet actif du dashboard praticien, dérivé directement de l'URL — pour
  // pouvoir surligner le bon onglet ici, dans la Navbar.
  const onDoctorDashboard = user?.role === 'doctor' && location.pathname === '/dashboard/doctor'
  const activeDoctorTab = searchParams.get('tab') || 'home'

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className={`max-w-6xl mx-auto px-4 flex items-center gap-2 transition-all duration-300 ${big ? 'h-28' : 'h-16'}`}>
        {/* Le logo ramène toujours vers la page d'accueil publique (recherche
            de praticien, etc.) — même connecté. Pour revenir à son dashboard,
            le praticien a l'onglet "Mon espace" juste à côté. */}
        <Link to="/" className="flex items-center flex-shrink-0">
          <img src={logoNavbar} alt="Animéaux" className={`w-auto transition-all duration-300 ${big ? 'h-20' : 'h-12'}`} />
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

        {/* Propriétaire d'animal (et admin) : à l'image de Doctolib, la
            recherche ne se fait plus que depuis la barre de l'écran
            d'accueil (accessible via le logo) — plus de raccourci direct
            "Trouver un praticien" ici. Messages et Profil sont gérés plus
            loin, en icônes à côté de la cloche. */}
        {user && user.role !== 'doctor' && user.role !== 'secretary' && (
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
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

        {/* Secrétariat : espace dédié au cabinet uniquement, sans les liens
            patient/praticien (recherche, messages, profil personnel...). */}
        {user?.role === 'secretary' && (
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <span className="text-sm text-gray-600 font-medium truncate">
              {staffInfo?.name ?? 'Cabinet'} <span className="text-gray-400 font-normal">· Espace secrétariat</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          {user?.role === 'secretary' ? (
            <button onClick={() => signOut().then(() => navigate('/'))}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors">
              Déconnexion
            </button>
          ) : user ? (
            <>
              {/* Accès rapide Messages à côté de la cloche, pour tous les
                  rôles — même traitement que le praticien. Pastille rouge
                  dès qu'il y a un message non lu. */}
              <Link to={user.role === 'doctor' ? '/dashboard/doctor?tab=messages' : '/messages'} title="Messages"
                className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors text-lg leading-none">
                ✉️
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
              <NotificationBell />
              <div className="flex items-center gap-2">
                <Link to={user.role === 'doctor' ? '/dashboard/doctor?tab=profil' : '/profil'} title="Mon profil"
                  className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-lg overflow-hidden hover:bg-sage-200 transition-colors">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Mon profil" />
                    : '👤'}
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
