// src/components/ui/Navbar.tsx
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'
import { DOCTOR_TABS, CABINET_TAB } from '@/lib/doctorDashboardTabs'
import { PATIENT_TABS } from '@/lib/patientNavTabs'
import { useConversationPartners, useMyClinicStaffInfo, useCurrentDoctor, useMyClinic } from '@/hooks/useData'
import logoNavbar from '@/assets/logo-navbar.webp'

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Pastille rouge sur l'enveloppe : les nouveaux messages ont leur propre
  // indicateur, séparé de la cloche de notifications (qui sert désormais
  // aux autres mises à jour : RDV confirmé/annulé, avis, etc.).
  const { data: conversationPartners = [] } = useConversationPartners()
  const unreadMessages = conversationPartners.reduce((sum, p) => sum + (p.unread_count || 0), 0)
  const { data: staffInfo } = useMyClinicStaffInfo()
  // Onglet "Mon cabinet" : uniquement pour un praticien qui a créé/rejoint
  // un cabinet — retour d'Anaïs du 07/09/2026. useCurrentDoctor n'est activé
  // que pour un compte docteur (enabled interne au hook), donc pas de requête
  // superflue pour les autres rôles.
  const { data: currentDoctor } = useCurrentDoctor()
  const { data: clinic } = useMyClinic(currentDoctor?.id)

  const dashboardPath =
    user?.role === 'doctor'    ? '/dashboard/doctor' :
    user?.role === 'secretary' ? '/dashboard/secretariat' :
    '/dashboard/patient'

  // Onglet actif du dashboard praticien, dérivé directement de l'URL — pour
  // pouvoir surligner le bon onglet ici, dans la Navbar.
  const onDoctorDashboard = user?.role === 'doctor' && location.pathname === '/dashboard/doctor'
  const activeDoctorTab = searchParams.get('tab') || 'home'

  return (
    <nav className="bg-white border-b border-sand-200 sticky top-0 z-50">
      {/* Barre toujours compacte, même sur l'accueil au premier chargement —
          la variante "grande puis rétrécit au scroll" (avant la refonte du
          07/09/2026) laissait un bandeau blanc disproportionné au-dessus du
          bandeau orange, ne correspondant à aucune des maquettes. */}
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-2 h-16">
        {/* Le logo ramène toujours vers la page d'accueil publique (recherche
            de praticien, etc.) — même connecté. Pour revenir à son dashboard,
            le praticien a l'onglet "Mon espace" juste à côté. */}
        <Link to="/" className="flex items-center flex-shrink-0">
          <img src={logoNavbar} alt="Animéaux" className="w-auto h-12" />
        </Link>

        {/* Praticien : les catégories du dashboard (Accueil, Mes patients,
            Tarifs, Disponibilités, Avis) sont affichées ici, à la suite du
            logo — visibles dès la page d'accueil, sans clic supplémentaire. */}
        {/* Repris en bas d'écran sur mobile (DoctorMobileTabBar, montée dans
            DoctorDashboard.tsx) — la barre du haut restait illisible avec
            6 onglets qui débordaient sur petit écran ; masqué ici plutôt
            que dupliqué. */}
        {user?.role === 'doctor' && (
          <div className="hidden md:flex flex-1 min-w-0 items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
            {/* "Statistiques" masqué avec un cabinet : ses stats déménagent
                dans l'onglet Mon cabinet (visibilité restreinte au créateur
                pour celles des confrères) — retour d'Anaïs du 07/09/2026. */}
            {DOCTOR_TABS.filter(t => !(clinic && t.id === 'stats')).map(t => (
              <Link key={t.id} to={`/dashboard/doctor?tab=${t.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                  ${onDoctorDashboard && activeDoctorTab === t.id
                    ? 'bg-sage-500 text-white'
                    : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
                <span>{t.icon}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </Link>
            ))}
            {clinic && (
              <Link to={`/dashboard/doctor?tab=${CABINET_TAB.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                  ${onDoctorDashboard && activeDoctorTab === CABINET_TAB.id
                    ? 'bg-sage-500 text-white'
                    : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
                <span>{CABINET_TAB.icon}</span>
                <span className="hidden lg:inline">{CABINET_TAB.label}</span>
              </Link>
            )}
          </div>
        )}

        {/* Propriétaire d'animal : mêmes onglets directs que le praticien
            (Accueil, Mes animaux, Mes rendez-vous, Rappels, Documents) —
            chacun est une route à part entière ici, contrairement aux
            onglets praticien qui se distinguent par ?tab=... sur une seule
            page. Recherche accessible depuis la page d'accueil (logo) ;
            Messages et Profil restent en icônes à côté de la cloche, comme
            côté praticien. Masqué pour un compte is_admin : son tableau de
            bord est exclusivement l'espace admin (onglet ci-dessous), pas
            un dashboard propriétaire d'animal. */}
        {user && user.role !== 'doctor' && user.role !== 'secretary' && !user.is_admin && (
          <div className="hidden md:flex flex-1 min-w-0 items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide">
            {PATIENT_TABS.map(t => (
              <Link key={t.path} to={t.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                  ${location.pathname === t.path
                    ? 'bg-sage-500 text-white'
                    : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
                <span>{t.icon}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </Link>
            ))}
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

        {/* Onglet admin : indépendant du rôle principal du compte (is_admin
            est un booléen à part — voir migration 055) — visible pour
            n'importe quel compte marqué administrateur, sans lui faire
            perdre son tableau de bord habituel. */}
        {user?.is_admin && (
          <Link to="/dashboard/admin"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0
              ${location.pathname === '/dashboard/admin'
                ? 'bg-sage-500 text-white'
                : 'bg-sage-50 text-sage-600 hover:bg-sage-100'}`}>
            <span>🛡️</span>
            <span className="hidden lg:inline">Admin</span>
          </Link>
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
                {/* Masqué sur mobile côté praticien : la barre y est déjà
                    serrée (onglets + icônes), et un bouton dédié existe
                    désormais en fin de page Profil (DoctorDashboard.tsx) —
                    contrairement au patient/admin/secrétariat, qui n'ont
                    pas cette alternative, ce bouton reste leur seul moyen
                    de se déconnecter sur mobile. */}
                <button onClick={() => signOut().then(() => navigate('/'))}
                  className={`text-sm text-gray-500 hover:text-red-500 transition-colors ${user.role === 'doctor' ? 'hidden md:block' : ''}`}>
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
