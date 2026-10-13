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

// ── Offre gratuite (migration 127/128) ───────────────────────────────────────
// Un praticien en offre gratuite n'a qu'une fiche visible : ces onglets lui sont
// fermés (réservation, agenda, statistiques, tarifs réservables, dossiers de ses
// patients) et la messagerie, dans les deux sens (migration 128/133 côté base).
// Restent ouverts : Mon espace, Avis, Profil et Cabinet (il y voit l'état
// d'activation de son cabinet). Un onglet verrouillé reste cliquable : il affiche
// une page qui explique ce que l'abonnement apporte, plutôt qu'un lien mort.
export const FREE_PLAN_LOCKED_TABS: DoctorTab[] = ['patients', 'tarifs', 'disponibilites', 'stats', 'messages']

// `hasPro` vient de la base (useDoctorHasPro) : `undefined` tant que la réponse
// n'est pas là → rien n'est verrouillé (pas de cadenas qui clignote pour un
// abonné). Seul un `false` explicite verrouille.
export function isTabLocked(tab: string, hasPro: boolean | undefined): boolean {
  return hasPro === false && (FREE_PLAN_LOCKED_TABS as string[]).includes(tab)
}

export const LOCKED_TAB_PITCH: Partial<Record<DoctorTab, { title: string; body: string }>> = {
  patients: {
    title: 'Les dossiers de vos patients',
    body: "Avec l'abonnement, retrouvez les animaux que vous suivez, leur historique, et ajoutez vos suivis et pesées.",
  },
  tarifs: {
    title: 'Vos tarifs et prestations',
    body: "Avec l'abonnement, présentez vos prestations, leur prix et leur durée tels que vos patients les voient à la réservation.",
  },
  disponibilites: {
    title: 'Votre agenda et les réservations en ligne',
    body: "Avec l'abonnement, vos patients réservent directement dans vos créneaux, et vous gérez vos rendez-vous, vos disponibilités et vos rappels.",
  },
  messages: {
    title: 'La messagerie avec vos patients',
    body: "Avec l'abonnement, vos patients peuvent vous écrire et vous leur répondez sans quitter l'application.",
  },
  stats: {
    title: 'Vos statistiques',
    body: "Avec l'abonnement, suivez votre activité mois après mois et téléchargez votre export comptable.",
  },
}
