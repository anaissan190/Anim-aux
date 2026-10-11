// src/lib/doctorPlan.ts
// Offre d'un praticien (migration 127) : 'free' = fiche visible dans la
// recherche sans les autres fonctionnalités ; 'pro' = abonnement, tout est
// accessible. Un `plan` absent (profil en cache d'avant la migration) vaut
// « pro » : on ne retire jamais une fonctionnalité sur une valeur inconnue,
// seul un 'free' explicite restreint.
export type DoctorPlan = 'free' | 'pro'

export const PLAN_LABEL: Record<DoctorPlan, string> = {
  free: 'Offre gratuite',
  pro: 'Abonnement',
}

export function hasProFeatures(doctor: { plan?: string | null } | null | undefined): boolean {
  return doctor?.plan !== 'free'
}

export function otherPlan(plan: DoctorPlan): DoctorPlan {
  return plan === 'pro' ? 'free' : 'pro'
}
