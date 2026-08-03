// src/components/mobile/MobileTabBar.tsx
// Barre de navigation du bas de la coquille mobile patient (refonte "Wow /
// Aurora") : 4 onglets + un bouton central flottant vers la recherche, sur
// le modèle validé dans l'aperçu. Icône "Accueil" = la vraie icône d'appli
// (public/pwa-192.png), pas un pictogramme générique. Profil est ici (en bas
// à droite) plutôt que Messages, qui est monté dans MobileHeader — arbitrage
// validé en aperçu (option 1).
import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/dashboard/patient', label: 'Accueil' },
  { to: '/animaux', label: 'Animaux', icon: '🐾' },
  { to: '/rendez-vous', label: 'RDV', icon: '📅' },
  { to: '/profil', label: 'Profil', icon: '👤' },
] as const

export default function MobileTabBar() {
  const location = useLocation()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="relative flex items-center bg-white border-t border-gray-100 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] px-2">
        {TABS.slice(0, 2).map(tab => <TabButton key={tab.to} {...tab} active={location.pathname === tab.to} />)}

        <div className="w-16 flex-shrink-0" />

        {TABS.slice(2).map(tab => <TabButton key={tab.to} {...tab} active={location.pathname === tab.to} />)}

        <Link to="/search"
          className="absolute left-1/2 -translate-x-1/2 -top-3 w-[56px] h-[56px] rounded-full bg-sage-500 text-white
                     flex items-center justify-center text-2xl shadow-lg animate-fab-pulse">
          +
          <span className="absolute -bottom-4 text-[9.5px] font-semibold text-sage-700 whitespace-nowrap">Réserver</span>
        </Link>
      </div>
    </div>
  )
}

function TabButton({ to, label, icon, active }: { to: string; label: string; icon?: string; active: boolean }) {
  return (
    <Link to={to} className={`flex-1 flex flex-col items-center gap-0.5 py-1 ${active ? 'text-sage-600' : 'text-gray-400'}`}>
      <span className="relative w-[30px] h-[30px] flex items-center justify-center text-lg">
        {to === '/dashboard/patient'
          ? <img src="/pwa-192.png" alt="" className={`w-6 h-6 rounded-md ${active ? '' : 'grayscale opacity-60'}`} />
          : icon}
      </span>
      <span className="text-[10.5px] font-semibold">{label}</span>
    </Link>
  )
}
