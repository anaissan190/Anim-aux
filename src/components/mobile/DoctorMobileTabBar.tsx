// src/components/mobile/DoctorMobileTabBar.tsx
// Barre de navigation du bas pour l'espace praticien sur mobile, sur le
// modèle de MobileTabBar (patient) — les 6 onglets du dashboard tenaient
// mal dans la Navbar du haut sur petit écran (débordement horizontal,
// juste à côté du logo et des icônes notifications/messages/profil).
// Libellés raccourcis par rapport à DOCTOR_TABS (pensés pour le "hidden
// lg:inline" de la Navbar desktop, trop longs pour 6 colonnes étroites).
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { DoctorTab } from '@/lib/doctorDashboardTabs'

const TABS: { id: DoctorTab; label: string; icon: string }[] = [
  { id: 'home',           label: 'Espace',   icon: '🏠' },
  { id: 'patients',       label: 'Patients', icon: '🐾' },
  { id: 'tarifs',         label: 'Tarifs',   icon: '💰' },
  { id: 'disponibilites', label: 'Dispos',   icon: '🗓️' },
  { id: 'avis',           label: 'Avis',     icon: '⭐' },
  { id: 'stats',          label: 'Stats',    icon: '📊' },
]

export default function DoctorMobileTabBar() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const onDashboard = location.pathname === '/dashboard/doctor'
  const activeTab = searchParams.get('tab') || 'home'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="flex items-center bg-white border-t border-gray-100 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] px-1">
        {TABS.map(tab => (
          <Link key={tab.id} to={`/dashboard/doctor?tab=${tab.id}`}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1 ${onDashboard && activeTab === tab.id ? 'text-sage-600' : 'text-gray-400'}`}>
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-[9.5px] font-semibold leading-tight">{tab.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
