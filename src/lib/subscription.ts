// src/lib/subscription.ts
// Contenu et règles de l'écran « Mon abonnement » (/abonnement) : offres et prix
// affichés, libellé d'état d'un abonnement, traduction des erreurs du paiement,
// lecture du retour de la page de paiement Stripe.
//
// Les prix sont ceux décidés le 11-12/10/2026, affichés HORS TAXE. Ce ne sont que des
// textes : le prix réellement facturé est celui du « prix » créé dans Stripe
// (STRIPE_PRICE_PRO / STRIPE_PRICE_CABINET) — les deux doivent rester identiques.

export interface PlanOffer {
  id: 'free' | 'pro' | 'cabinet' | 'custom'
  name: string
  tagline: string
  priceHt: string | null // null = gratuit, sauf si priceLabel est renseigné
  priceLabel?: string // remplace le prix quand il n'y en a pas d'affiché (offre sur mesure)
  features: { label: string; included: boolean }[]
}

export const PLAN_OFFERS: Record<PlanOffer['id'], PlanOffer> = {
  free: {
    id: 'free', name: 'Gratuite', tagline: 'Pour être trouvé', priceHt: null,
    features: [
      { label: 'Fiche dans la recherche', included: true },
      { label: 'Avis et coordonnées', included: true },
      { label: 'Réservation en ligne', included: false },
      { label: 'Agenda et rappels', included: false },
      { label: 'Messagerie patients', included: false },
      { label: 'Dossiers et statistiques', included: false },
    ],
  },
  pro: {
    id: 'pro', name: 'Abonnement', tagline: 'Pour recevoir des rendez-vous', priceHt: '39,90',
    features: [
      { label: 'Fiche dans la recherche, avis et coordonnées', included: true },
      { label: 'Réservation en ligne', included: true },
      { label: 'Agenda, rappels par email et SMS', included: true },
      { label: 'Messagerie avec vos patients', included: true },
      { label: 'Dossiers des animaux, statistiques et export comptable', included: true },
    ],
  },
  cabinet: {
    id: 'cabinet', name: 'Abonnement cabinet', tagline: "Pour une équipe jusqu'à 5 praticiens", priceHt: '95,90',
    features: [
      { label: "Toutes les fonctions de l'abonnement, pour chaque praticien", included: true },
      { label: "Jusqu'à 5 praticiens dans le cabinet", included: true },
      { label: 'Agenda partagé et statistiques du cabinet', included: true },
      { label: 'Accès dédié pour votre secrétariat', included: true },
    ],
  },
  // Plus de 5 praticiens : pas de tarif publié, le prix est fixé avec chaque cabinet (15/10/2026).
  custom: {
    id: 'custom', name: 'Grand cabinet', tagline: 'Plus de 5 praticiens', priceHt: null, priceLabel: 'Sur mesure',
    features: [
      { label: "Toutes les fonctions de l'abonnement cabinet", included: true },
      { label: 'Plus de 5 praticiens dans le même cabinet', included: true },
      { label: "Un prix fixé avec vous, selon la taille de l'équipe", included: true },
    ],
  },
}

// Franchise en base de TVA (micro-entreprise sous le seuil, décidé le 15/10/2026) : les prix affichés
// sont ceux que le client paie, sans mention « HT ». Quand la TVA deviendra applicable (seuil dépassé),
// c'est ICI et dans les textes qui utilisent VAT_NOTE qu'il faudra revenir (et activer Stripe Tax).
export const VAT_NOTE = 'TVA non applicable, art. 293 B du CGI'

export const PRICE_FOOTNOTE = `Prix mensuels, ${VAT_NOTE}. Paiement sécurisé par Stripe. Résiliable à tout moment : l’abonnement reste actif jusqu’à la fin de la période payée.`

// Codes d'erreur renvoyés par les fonctions de paiement, en français.
export const BILLING_ERRORS: Record<string, string> = {
  prelaunch: "Les abonnements ouvriront avec le lancement : vous pouvez dès maintenant indiquer la formule qui vous intéresse, sans payer.",
  billing_not_configured: "Le paiement en ligne n'est pas encore ouvert. Réessayez bientôt.",
  billing_misconfigured: "Le paiement en ligne n'est pas disponible pour le moment. Réessayez plus tard.",
  not_verified: "L'abonnement est proposé dès que votre dossier est validé par notre équipe.",
  not_a_doctor: "L'abonnement est réservé aux praticiens.",
  already_subscribed: 'Vous avez déjà un abonnement actif.',
  clinic_name_required: 'Indiquez le nom de votre cabinet.',
  quote_not_found: "Ce lien de paiement n'est pas valide. Vérifiez qu'il a été copié en entier, ou écrivez-nous.",
  not_your_quote: 'Ce lien de paiement est associé à un autre compte. Connectez-vous avec le compte qui a fait la demande de devis.',
  already_paid: 'Ce devis a déjà été réglé : votre abonnement est actif.',
  link_disabled: "Ce lien de paiement n'est plus actif. Écrivez-nous pour en obtenir un nouveau.",
  no_customer: "Aucun abonnement à gérer pour l'instant.",
  stripe_error: "Le service de paiement n'a pas répondu. Réessayez dans un instant.",
  unauthorized: 'Votre session a expiré : reconnectez-vous.',
  invalid_plan: "Cette offre n'existe pas.",
  internal: 'Une erreur est survenue. Réessayez dans un instant.',
}

// Affiché à côté de la case quand quelqu'un clique sur « Choisir l'abonnement » sans l'avoir cochée.
export const TERMS_REQUIRED_MESSAGE = "Cochez la case ci-dessous pour accepter les conditions générales : c'est nécessaire pour choisir un abonnement."

export function billingErrorMessage(code: string | null | undefined): string {
  return (code && BILLING_ERRORS[code]) || BILLING_ERRORS.internal
}

// Retour de la page de paiement : /abonnement?paiement=succes | annule
export type PaymentReturn = 'success' | 'cancelled' | null

export function paymentReturnFromSearch(search: string): PaymentReturn {
  const v = new URLSearchParams(search).get('paiement')
  return v === 'succes' ? 'success' : v === 'annule' ? 'cancelled' : null
}

export interface SubscriptionRow {
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at?: string
}

const PAID = ['active', 'trialing', 'past_due']

// L'abonnement à présenter parmi toutes les lignes d'un titulaire : un abonnement payant
// (le plus récent d'abord), sinon le plus récent.
export function currentSubscription(rows: SubscriptionRow[] | null | undefined): SubscriptionRow | null {
  if (!rows || rows.length === 0) return null
  const byRecent = [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return byRecent.find(r => PAID.includes(r.status)) ?? byRecent[0]
}

function frDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso))
}

// Phrase d'état affichée sur la carte « Votre abonnement ».
export function describeSubscription(sub: SubscriptionRow | null): { tone: 'ok' | 'warning' | 'neutral'; text: string } {
  if (!sub) return { tone: 'neutral', text: 'Abonnement offert par Animéaux.' }
  const end = sub.current_period_end ? frDate(sub.current_period_end) : null
  if (sub.status === 'past_due') {
    return { tone: 'warning', text: "Le dernier paiement n'a pas abouti : mettez à jour votre carte depuis « Gérer mon abonnement » pour éviter la coupure." }
  }
  if (PAID.includes(sub.status)) {
    if (sub.cancel_at_period_end) {
      return { tone: 'warning', text: end ? `Résilié : l’abonnement reste actif jusqu’au ${end}.` : 'Résilié : actif jusqu’à la fin de la période payée.' }
    }
    return { tone: 'ok', text: end ? `Actif, prochain renouvellement le ${end}.` : 'Actif.' }
  }
  return { tone: 'neutral', text: 'Abonnement terminé.' }
}

// Carte « Gratuite » : que proposer selon la situation ?
//  - current   : déjà en offre gratuite
//  - downgrade : abonné via Stripe, peut revenir à la gratuite (en résiliant sur le portail)
//  - scheduled : résiliation déjà programmée, retour à la gratuite à la fin de la période payée
//  - granted   : offre accordée sans abonnement Stripe (fondateur) ou via le cabinet : pas de bouton
export type FreePlanState =
  | { kind: 'current' }
  | { kind: 'downgrade' }
  | { kind: 'scheduled'; until: string | null }
  | { kind: 'granted' }

export function freePlanState(hasPro: boolean | undefined, sub: SubscriptionRow | null): FreePlanState {
  if (!hasPro) return { kind: 'current' }
  if (!sub || !PAID.includes(sub.status)) return { kind: 'granted' }
  if (sub.cancel_at_period_end) return { kind: 'scheduled', until: sub.current_period_end ? frDate(sub.current_period_end) : null }
  return { kind: 'downgrade' }
}

// Vrai quand un abonnement en cours (résiliation non programmée) doit être arrêté pour pouvoir
// supprimer le compte (miroir de delete_my_account, migration 134) : la suppression passe alors
// par la fonction Edge delete-my-account, qui l'arrête puis supprime, sans quitter l'écran.
export function hasSubscriptionToEnd(rows: SubscriptionRow[] | null | undefined): boolean {
  return (rows ?? []).some(r => PAID.includes(r.status) && !r.cancel_at_period_end)
}
