// src/lib/quotePrice.ts
// Prix d'un devis « grand cabinet » (plus de 5 praticiens), en centimes HT par mois :
// l'abonnement cabinet (jusqu'à 5 praticiens) + un supplément par praticien en plus.
// Règle décidée le 15/10/2026 ; ce n'est qu'une SUGGESTION pré-remplie dans l'administration,
// l'admin fixe le prix réel (remise possible). Le prix de base doit rester celui du cabinet
// affiché dans PLAN_OFFERS (voir quotePrice.test.ts).
export const INCLUDED_PRACTITIONERS = 5
export const CABINET_BASE_CENTS = 9590
export const EXTRA_PRACTITIONER_CENTS = 1990

export function suggestedMonthlyCents(practitioners: number): number {
  const extra = Math.max(0, Math.floor(practitioners) - INCLUDED_PRACTITIONERS)
  return CABINET_BASE_CENTS + extra * EXTRA_PRACTITIONER_CENTS
}

// 15560 → « 155,60 € »
export function formatCents(cents: number): string {
  const rest = String(Math.abs(cents % 100)).padStart(2, '0')
  return `${Math.floor(cents / 100)},${rest} €`
}

// « 155,60 », « 155.6 », « 155 » → centimes ; null si la saisie n'est pas un prix.
export function parseEuros(input: string): number | null {
  const clean = input.trim().replace(/\s/g, '').replace('€', '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}

export function quotePaymentUrl(token: string, origin = 'https://monanimeaux.fr'): string {
  return `${origin}/paiement-devis/${token}`
}

export const MIN_OFFER_PRACTITIONERS = 6
export const MAX_OFFER_PRACTITIONERS = 200
export const MIN_OFFER_CENTS = 1000
export const MAX_OFFER_CENTS = 1_000_000

export type OfferValidation =
  | { ok: true; maxPractitioners: number; priceCents: number }
  | { ok: false; error: string }

// Offre saisie par l'admin (mêmes bornes que admin_prepare_quote_payment, migration 136).
export function validateOffer(practitioners: string, price: string): OfferValidation {
  const n = practitioners.trim()
  if (!/^\d+$/.test(n) || Number(n) < MIN_OFFER_PRACTITIONERS || Number(n) > MAX_OFFER_PRACTITIONERS) {
    return { ok: false, error: `Le nombre de praticiens doit être un entier entre ${MIN_OFFER_PRACTITIONERS} et ${MAX_OFFER_PRACTITIONERS} (jusqu'à 5, l'abonnement cabinet normal convient).` }
  }
  const cents = parseEuros(price)
  if (cents === null) return { ok: false, error: 'Indique le prix mensuel hors taxes, par exemple 155,60.' }
  if (cents < MIN_OFFER_CENTS || cents > MAX_OFFER_CENTS) {
    return { ok: false, error: 'Le prix mensuel doit être compris entre 10 et 10 000 € HT.' }
  }
  return { ok: true, maxPractitioners: Number(n), priceCents: cents }
}
