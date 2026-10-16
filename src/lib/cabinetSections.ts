// src/lib/cabinetSections.ts
// Sous-onglets de l'onglet « Mon cabinet » du praticien et lecture de ?section=… dans l'adresse.
// Le créateur du cabinet a tout ; un simple membre n'a ni le secrétariat ni les réglages (profil du
// cabinet, fermeture) : ces sections lui sont refusées, même par l'adresse.
export type CabinetSection = 'apercu' | 'equipe' | 'stats' | 'secretariat' | 'reglages'

const ALL: { id: CabinetSection; label: string; adminOnly: boolean }[] = [
  { id: 'apercu', label: "Vue d'ensemble", adminOnly: false },
  { id: 'equipe', label: 'Équipe', adminOnly: false },
  { id: 'secretariat', label: 'Secrétariat', adminOnly: true },
  { id: 'reglages', label: 'Réglages', adminOnly: true },
  // Les statistiques viennent en dernier (demande d'Anaïs, 16/10/2026).
  { id: 'stats', label: 'Statistiques', adminOnly: false },
]

export function cabinetSections(isAdmin: boolean): { id: CabinetSection; label: string }[] {
  return ALL.filter(s => isAdmin || !s.adminOnly).map(({ id, label }) => ({ id, label }))
}

export function parseCabinetSection(value: string | null | undefined, isAdmin: boolean): CabinetSection {
  return cabinetSections(isAdmin).some(s => s.id === value) ? (value as CabinetSection) : 'apercu'
}
