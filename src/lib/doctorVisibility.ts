// src/lib/doctorVisibility.ts
// Un praticien est visible du public (recherche, fiche directe, réservation)
// s'il est vérifié ET n'a pas choisi de se masquer (migration 126, interrupteur
// « Apparaître dans la recherche »). `is_listed` absent ou null (profil en cache
// d'avant la migration) vaut « visible » : seul un `false` explicite masque.
// Miroir de la policy RLS « doctors: lecture publique verifiee » côté base.
export function isPubliclyListed(
  doctor: { verification_status?: string | null; is_listed?: boolean | null } | null | undefined,
): boolean {
  if (!doctor) return false
  return doctor.verification_status === 'verified' && doctor.is_listed !== false
}
