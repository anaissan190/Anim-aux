// src/lib/cabinetQuote.ts
// Questionnaire « Grand cabinet » (plus de 5 praticiens, /devis-cabinet) : validation et
// messages d'erreur. La validation est CELLE de la fonction Edge request-cabinet-quote
// (importée telle quelle) : le formulaire et le serveur ne peuvent pas diverger.
import {
  validateQuoteRequest, MIN_PRACTITIONERS, MAX_REQUESTS_PER_DAY,
  type QuoteErrorCode, type QuoteInput,
} from '../../supabase/functions/request-cabinet-quote/quote'

export { validateQuoteRequest, MIN_PRACTITIONERS }
export type { QuoteErrorCode, QuoteInput }

export const QUOTE_ERRORS: Record<QuoteErrorCode | 'too_many_requests' | 'not_a_doctor' | 'unauthorized' | 'internal', string> = {
  clinic_name_required: 'Indiquez le nom de votre cabinet.',
  practitioner_count_invalid: 'Indiquez le nombre de praticiens de votre cabinet (un nombre entier).',
  too_few_practitioners: `Pour ${MIN_PRACTITIONERS - 1} praticiens ou moins, l'abonnement cabinet convient : son prix est affiché sur la page précédente.`,
  next_year_invalid: 'Le nombre de praticiens prévu dans un an doit être un nombre entier.',
  secretary_count_invalid: 'Le nombre de personnes au secrétariat doit être un nombre entier.',
  phone_invalid: 'Ce numéro de téléphone ne semble pas valide.',
  consent_required: "Cochez la case pour accepter que nous utilisions ces informations afin de vous répondre : c'est nécessaire pour envoyer la demande.",
  too_long: 'Un des textes est trop long. Raccourcissez-le puis réessayez.',
  too_many_requests: `Vous avez déjà envoyé ${MAX_REQUESTS_PER_DAY} demandes aujourd'hui. Nous revenons vers vous très vite.`,
  not_a_doctor: 'Cette demande est réservée aux praticiens.',
  unauthorized: 'Votre session a expiré : reconnectez-vous.',
  internal: "Une erreur est survenue, votre demande n'a pas été envoyée. Réessayez dans un instant.",
}

export function quoteErrorMessage(code: string | null | undefined): string {
  return (code && (QUOTE_ERRORS as Record<string, string>)[code]) || QUOTE_ERRORS.internal
}

export type QuoteStatus = 'new' | 'quote_sent' | 'accepted' | 'declined'

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  new: 'Nouvelle',
  quote_sent: 'Devis envoyé',
  accepted: 'Devis accepté',
  declined: 'Sans suite',
}

export const QUOTE_STATUS_ORDER: QuoteStatus[] = ['new', 'quote_sent', 'accepted', 'declined']

// Les demandes à traiter : tant que le devis n'est ni accepté ni abandonné.
export const OPEN_QUOTE_STATUSES: QuoteStatus[] = ['new', 'quote_sent']

export function isOpenQuote(status: QuoteStatus): boolean {
  return OPEN_QUOTE_STATUSES.includes(status)
}
