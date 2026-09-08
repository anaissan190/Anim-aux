// src/lib/doctorSearch.ts
// Extrait de useDoctors (src/hooks/useData.ts) pour être testable : un bug
// réel (comparaison dans un seul sens) a rendu une comportementaliste
// introuvable en recherche publique le 08/09/2026 après le renommage de
// son intitulé de métier ("Comportementaliste" → "Comportementaliste
// animalier", commit ba0133f) sans mise à jour de sa fiche existante.
export function matchesSpecialtySearch(specialty: string | null | undefined, term: string): boolean {
  const normalized = (specialty ?? '').toLowerCase().trim()
  if (!normalized) return false
  // Comparaison dans les deux sens : un intitulé stocké plus court que le
  // terme recherché (ex. libellé renommé depuis, sans backfill des fiches
  // existantes) ne peut jamais matcher avec un simple includes(term) à sens
  // unique — le "besoin" (needle) ne peut pas être plus long que la
  // "botte de foin" (haystack).
  return normalized.includes(term) || term.includes(normalized)
}
