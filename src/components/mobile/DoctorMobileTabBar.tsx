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
      <div className="flex items-center bg-sage-50 border-t-[1.5px] border-sage-100 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] px-1">
        {TABS.map(tab => {
          const active = onDashboard && activeTab === tab.id
          return (
            <Link key={tab.id} to={`/dashboard/doctor?tab=${tab.id}`}
              className={`relative flex-1 flex flex-col items-center gap-[3px] ${active ? 'text-sage-600' : 'text-gray-400'}`}>
              {active && (
                <span className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-sage-500" />
              )}
              <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>{tab.icon}</span>
              <span className="text-[9.5px] font-bold leading-tight">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
