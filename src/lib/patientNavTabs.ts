// src/lib/patientNavTabs.ts
// Onglets du propriétaire d'animal affichés directement dans la Navbar, à
// la suite du logo — même traitement que DOCTOR_TABS (doctorDashboardTabs.ts) :
// visibles dès l'arrivée sur la page, sans clic supplémentaire. Contrairement
// au praticien (une seule page, onglets en ?tab=...), chaque onglet ici est
// une route à part entière (déjà existante avant cette barre).
// Messages et Profil restent accessibles via les icônes à côté de la
// cloche de notifications, pas dans cette barre — même choix que côté
// praticien.

// "Rappels" volontairement absent : les rappels de vaccin sont déjà dans
// l'onglet Vaccins de la fiche de l'animal, et les rappels de RDV dans
// "Mes rendez-vous" — un onglet dédié ferait doublon (retiré le 07/09/2026
// suite au retour d'Anaïs après l'ajout initial de cette barre).
export const PATIENT_TABS: { path: string; label: string; icon: string }[] = [
  { path: '/dashboard/patient', label: 'Accueil',         icon: '🏠' },
  { path: '/animaux',           label: 'Mes animaux',     icon: '🐾' },
  { path: '/rendez-vous',       label: 'Mes rendez-vous', icon: '📅' },
  { path: '/documents',         label: 'Documents',       icon: '📄' },
]
