// src/lib/profileSections.ts
// Sous-onglets de l'onglet Profil du praticien (DoctorDashboard) et lecture du paramètre d'adresse
// ?section=… (ex. /dashboard/doctor?tab=profil&section=abonnement). Une valeur inconnue ou absente
// ouvre « Mon profil ».
export type ProfileSection = 'profil' | 'abonnement' | 'notifications' | 'donnees'

export const PROFILE_SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: 'profil', label: 'Mon profil' },
  { id: 'abonnement', label: 'Abonnement et vérification' },
  { id: 'notifications', label: 'Notifications et agenda' },
  { id: 'donnees', label: 'Données et compte' },
]

export function parseProfileSection(value: string | null | undefined): ProfileSection {
  return PROFILE_SECTIONS.some(s => s.id === value) ? (value as ProfileSection) : 'profil'
}
