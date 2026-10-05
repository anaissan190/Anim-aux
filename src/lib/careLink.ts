// src/lib/careLink.ts
// Miroir côté client de la règle SQL doctor_has_care_link (migration 116) :
// un rendez-vous "compte" comme lien de soin s'il est MAINTENU (confirmé ou
// terminé) et date de moins d'un an (futur compris). Sert à ne lister dans
// "Mes patients" que les patients dont la fiche est réellement lisible, plutôt
// que des lignes vides pour un accès expiré.
export const CARE_LINK_WINDOW_DAYS = 365

export function isCareLinkAppointment(
  appointment: { status: string; start_at: string },
  now: Date = new Date()
): boolean {
  if (appointment.status !== 'confirmed' && appointment.status !== 'completed') return false
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - CARE_LINK_WINDOW_DAYS)
  return new Date(appointment.start_at) > cutoff
}
