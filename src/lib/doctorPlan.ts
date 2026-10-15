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

// Au-delà de MAX_CLINIC_PRACTITIONERS, pas de tarif affiché : offre sur mesure, au cas
// par cas (décision d'Anaïs, 15/10/2026). Un supplément par praticien viendra si la
// demande se confirme.
export const CONTACT_EMAIL = 'contact@monanimeaux.fr'
export const LARGE_CABINET_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Cabinet de plus de 5 praticiens')}`

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

// Pastilles d'état d'un praticien dans l'administration : offre gratuite et/ou
// fiche masquée de la recherche. L'abonnement est l'état normal, il n'a pas de
// pastille. Les valeurs absentes (cache d'avant les migrations 126/127) ne
// produisent rien : seul un 'free' ou un `false` explicite est signalé.
export function doctorFlagLabels(flags: { plan?: string | null; is_listed?: boolean | null } | null | undefined): string[] {
  const labels: string[] = []
  if (flags?.plan === 'free') labels.push('Offre gratuite')
  if (flags?.is_listed === false) labels.push('Masqué')
  return labels
}

// Texte d'état du cabinet dans l'espace du créateur : activé (places restantes)
// ou non activé (ce que cela interdit).
export function clinicStatusText(plan: string | null | undefined, memberCount: number): { active: boolean; text: string } {
  if (plan === 'free') {
    return {
      active: false,
      text: "Ce cabinet n'est pas encore activé : l'abonnement cabinet permet d'accueillir jusqu'à "
        + `${MAX_CLINIC_PRACTITIONERS} praticiens et d'inviter un secrétariat.`,
    }
  }
  const left = clinicSeatsLeft('cabinet', memberCount)
  return {
    active: true,
    text: `${memberCount} praticien${memberCount > 1 ? 's' : ''} sur ${MAX_CLINIC_PRACTITIONERS}`
      + (left === 0
        ? ` : le cabinet est complet. Pour accueillir plus de ${MAX_CLINIC_PRACTITIONERS} praticiens, écrivez à ${CONTACT_EMAIL} : une offre sur mesure est possible.`
        : '.'),
  }
}
