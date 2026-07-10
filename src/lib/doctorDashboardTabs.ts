// src/lib/doctorDashboardTabs.ts
// Config partagée entre DoctorDashboard (contenu des onglets) et Navbar
// (affichage des onglets directement dans la barre du haut, à la suite du
// logo, pour qu'ils soient visibles dès l'arrivée sur la page d'accueil
// sans avoir à cliquer sur quoi que ce soit).

export type DoctorTab = 'home' | 'patients' | 'tarifs' | 'disponibilites' | 'profil' | 'avis' | 'messages'

// Onglets affichés dans la barre. "Mon profil" et "Messages" restent des
// DoctorTab valides (contenu inchangé, accessible via ?tab=...) mais ne sont
// pas listés ici : ils sont accessibles via les icônes à côté de la cloche
// de notifications.
export const DOCTOR_TABS: { id: DoctorTab; label: string; icon: string }[] = [
  { id: 'home',           label: 'Accueil',         icon: '🏠' },
  { id: 'patients',       label: 'Mes patients',    icon: '🐾' },
  { id: 'tarifs',         label: 'Tarifs',           icon: '💰' },
  { id: 'disponibilites', label: 'Disponibilités',   icon: '🗓️' },
  { id: 'avis',           label: 'Avis',             icon: '⭐' },
]

export const ALL_DOCTOR_TAB_IDS: DoctorTab[] = ['home', 'patients', 'tarifs', 'disponibilites', 'profil', 'avis', 'messages']
