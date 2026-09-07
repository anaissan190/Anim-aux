// src/lib/doctorDashboardTabs.ts
// Config partagée entre DoctorDashboard (contenu des onglets) et Navbar
// (affichage des onglets directement dans la barre du haut, à la suite du
// logo, pour qu'ils soient visibles dès l'arrivée sur la page d'accueil
// sans avoir à cliquer sur quoi que ce soit).

export type DoctorTab = 'home' | 'patients' | 'tarifs' | 'disponibilites' | 'cabinet' | 'profil' | 'avis' | 'messages' | 'stats'

// Onglets affichés dans la barre. "Mon profil" et "Messages" restent des
// DoctorTab valides (contenu inchangé, accessible via ?tab=...) mais ne sont
// pas listés ici : ils sont accessibles via les icônes à côté de la cloche
// de notifications. "cabinet" n'est pas non plus dans ce tableau statique :
// il n'apparaît que pour un praticien qui a créé/rejoint un cabinet (retour
// d'Anaïs du 07/09/2026) — Navbar/DoctorMobileTabBar l'ajoutent eux-mêmes de
// façon conditionnelle, à la suite de ces onglets fixes.
export const DOCTOR_TABS: { id: DoctorTab; label: string; icon: string }[] = [
  { id: 'home',           label: 'Mon espace',      icon: '🏠' },
  { id: 'patients',       label: 'Mes patients',    icon: '🐾' },
  { id: 'tarifs',         label: 'Tarifs',           icon: '💰' },
  // Libellé "RDV" depuis le 14/08/2026 : cet onglet montre désormais la
  // liste des rendez-vous en premier, la gestion des disponibilités ayant
  // été repoussée en bas de la même page (id technique inchangé pour ne
  // pas casser les liens ?tab=disponibilites existants).
  { id: 'disponibilites', label: 'RDV',              icon: '📅' },
  { id: 'avis',           label: 'Avis',             icon: '⭐' },
  { id: 'stats',          label: 'Statistiques',     icon: '📊' },
]

// Onglet cabinet — même forme que DOCTOR_TABS, ajouté séparément par Navbar/
// DoctorMobileTabBar seulement quand le praticien a un cabinet.
export const CABINET_TAB = { id: 'cabinet' as const, label: 'Mon cabinet', icon: '🏥' }

export const ALL_DOCTOR_TAB_IDS: DoctorTab[] = ['home', 'patients', 'tarifs', 'disponibilites', 'cabinet', 'profil', 'avis', 'messages', 'stats']
