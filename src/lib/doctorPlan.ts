// src/lib/doctorPlan.ts
// Offres (migration 127).
//   Praticien : 'free' = fiche visible dans la recherche sans les autres
//   fonctionnalités ; 'pro' = abonnement individuel.
//   Cabinet : 'free' = non activé (1 seul praticien, son créateur) ;
//   'cabinet' = abonnement cabinet, jusqu'à MAX_CLINIC_PRACTITIONERS praticiens.
// Un praticien a toutes les fonctionnalités s'il est abonné lui-même OU membre
// d'un cabinet abonné (miroir de doctor_has_pro côté base). Une valeur absente
// (profil en cache d'avant la migration) vaut « abonné » : on ne retire jamais
// une fonctionnalité sur une valeur inconnue, seul un 'free' explicite restreint.
export type DoctorPlan = 'free' | 'pro'
export type ClinicPlan = 'free' | 'cabinet'

// Même valeur que dans le trigger enforce_clinic_member_limit.
export const MAX_CLINIC_PRACTITIONERS = 5

export const PLAN_LABEL: Record<DoctorPlan, string> = {
  free: 'Offre gratuite',
  pro: 'Abonnement',
}

export const CLINIC_PLAN_LABEL: Record<ClinicPlan, string> = {
  free: 'Cabinet non activé',
  cabinet: 'Abonnement cabinet',
}

export function hasProFeatures(
  doctor: { plan?: string | null } | null | undefined,
  clinic?: { plan?: string | null } | null,
): boolean {
  if (doctor?.plan !== 'free') return true
  return clinic?.plan === 'cabinet'
}

export function otherPlan(plan: DoctorPlan): DoctorPlan {
  return plan === 'pro' ? 'free' : 'pro'
}

export function otherClinicPlan(plan: ClinicPlan): ClinicPlan {
  return plan === 'cabinet' ? 'free' : 'cabinet'
}

// Nombre de praticiens qu'un cabinet peut encore accueillir.
export function clinicSeatsLeft(plan: ClinicPlan | null | undefined, memberCount: number): number {
  const max = plan === 'cabinet' ? MAX_CLINIC_PRACTITIONERS : 1
  return Math.max(0, max - memberCount)
}
