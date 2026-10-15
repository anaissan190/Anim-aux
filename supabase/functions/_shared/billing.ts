// supabase/functions/_shared/billing.ts
// Logique pure du paiement par abonnement (Stripe) : aucun import, donc testable
// avec Vitest (voir billing.test.ts) et partagée par les fonctions Edge
// create-checkout-session, create-portal-session et stripe-webhook (import
// relatif avec extension .ts, comme l'exige Deno).
//
// Principe : Stripe est la source de vérité de l'abonnement. Le site ne fait que
// (1) envoyer la personne payer (Checkout), (2) lui laisser gérer sa carte et
// résilier (portail client), (3) recopier l'état de l'abonnement dans la base grâce
// aux événements signés du webhook. L'offre (`doctors.plan` / `clinics.plan`) n'est
// JAMAIS modifiée à partir d'une redirection du navigateur, seulement du webhook.

export type PaidPlan = 'pro' | 'cabinet'
export type SubscriptionKind = 'doctor' | 'clinic'

// Statuts Stripe qui donnent accès à l'abonnement. `past_due` = un prélèvement a
// échoué mais Stripe réessaie pendant plusieurs jours : on garde l'accès le temps
// de cette relance plutôt que de couper à la première erreur de carte.
export const PAID_STATUSES = ['active', 'trialing', 'past_due'] as const

export function isPaidStatus(status: string | null | undefined): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status ?? '')
}

export function kindForPlan(plan: PaidPlan): SubscriptionKind {
  return plan === 'pro' ? 'doctor' : 'clinic'
}

// Identifiants de prix Stripe, posés par Anaïs dans les secrets des fonctions Edge
// (jamais dans le code). `null` = paiement pas encore configuré pour cette offre.
export function priceIdForPlan(plan: string, env: Record<string, string | undefined>): string | null {
  const id = plan === 'pro' ? env.STRIPE_PRICE_PRO : plan === 'cabinet' ? env.STRIPE_PRICE_CABINET : undefined
  return id && id.trim() ? id.trim() : null
}

// Contrôle de la configuration AVANT d'appeler Stripe, pour distinguer « pas encore configuré »
// (secret absent) d'« configuré de travers » (erreur de recopie fréquente : clé publiable à la
// place de la clé secrète, identifiant de produit `prod_` à la place de l'identifiant de prix
// `price_`). Le détail n'est destiné qu'aux journaux, jamais au navigateur.
export type BillingConfig =
  | { ok: true; secretKey: string; priceId: string }
  | { ok: false; code: 'billing_not_configured' | 'billing_misconfigured'; problem: string }

// Clé secrète seule, pour les paiements au prix du devis (le prix y est fixé à la volée, il
// n'y a pas de STRIPE_PRICE_* à vérifier).
export type StripeKeyConfig =
  | { ok: true; secretKey: string }
  | { ok: false; code: 'billing_not_configured' | 'billing_misconfigured'; problem: string }

export function checkStripeSecret(env: Record<string, string | undefined>): StripeKeyConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) return { ok: false, code: 'billing_not_configured', problem: 'STRIPE_SECRET_KEY est absent' }
  if (secretKey.startsWith('pk_')) {
    return { ok: false, code: 'billing_misconfigured', problem: 'STRIPE_SECRET_KEY contient la clé PUBLIABLE (pk_…) : il faut la clé SECRÈTE (sk_…)' }
  }
  if (!/^(sk|rk)_(test|live)_/.test(secretKey)) {
    return { ok: false, code: 'billing_misconfigured', problem: 'STRIPE_SECRET_KEY ne ressemble pas à une clé secrète Stripe (attendu : sk_test_… ou sk_live_…)' }
  }
  return { ok: true, secretKey }
}

export function checkBillingConfig(plan: string, env: Record<string, string | undefined>): BillingConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim()
  const priceEnv = plan === 'pro' ? 'STRIPE_PRICE_PRO' : plan === 'cabinet' ? 'STRIPE_PRICE_CABINET' : null
  const priceId = priceEnv ? env[priceEnv]?.trim() : undefined

  if (!secretKey) return { ok: false, code: 'billing_not_configured', problem: 'STRIPE_SECRET_KEY est absent' }
  if (!priceEnv || !priceId) {
    return { ok: false, code: 'billing_not_configured', problem: `${priceEnv ?? 'identifiant de prix'} est absent` }
  }
  if (secretKey.startsWith('pk_')) {
    return { ok: false, code: 'billing_misconfigured', problem: 'STRIPE_SECRET_KEY contient la clé PUBLIABLE (pk_…) : il faut la clé SECRÈTE (sk_…)' }
  }
  if (!/^(sk|rk)_(test|live)_/.test(secretKey)) {
    return { ok: false, code: 'billing_misconfigured', problem: 'STRIPE_SECRET_KEY ne ressemble pas à une clé secrète Stripe (attendu : sk_test_… ou sk_live_…)' }
  }
  if (priceId.startsWith('prod_')) {
    return { ok: false, code: 'billing_misconfigured', problem: `${priceEnv} contient un identifiant de PRODUIT (prod_…) : il faut l'identifiant du PRIX (price_…)` }
  }
  if (!priceId.startsWith('price_')) {
    return { ok: false, code: 'billing_misconfigured', problem: `${priceEnv} ne ressemble pas à un identifiant de prix Stripe (attendu : price_…)` }
  }
  return { ok: true, secretKey, priceId }
}

// --- Abonnement Stripe → état à enregistrer -----------------------------------

export interface StripeSubscriptionLike {
  id?: string
  status?: string
  customer?: string | { id?: string } | null
  cancel_at_period_end?: boolean
  // Selon la version de l'API Stripe, la fin de période est sur l'abonnement
  // (anciennes versions) ou sur chaque ligne d'abonnement (versions récentes).
  current_period_end?: number | null
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number | null }> }
  metadata?: Record<string, string> | null
}

export interface SubscriptionState {
  kind: SubscriptionKind
  targetId: string
  customerId: string
  subscriptionId: string
  priceId: string | null
  status: string
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  // Abonnement au prix d'un devis « grand cabinet » : limite de praticiens et demande d'origine.
  maxPractitioners: number | null
  quoteId: string | null
}

// Limite de praticiens portée par les métadonnées (5 à 200) ; toute autre valeur est ignorée.
export function parseMaxPractitioners(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= 5 && n <= 200 ? n : null
}

export function extractSubscriptionState(sub: StripeSubscriptionLike | null | undefined): SubscriptionState | null {
  if (!sub || !sub.id || !sub.status) return null
  const kind = sub.metadata?.kind
  const targetId = sub.metadata?.target_id
  if ((kind !== 'doctor' && kind !== 'clinic') || !targetId) return null

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!customerId) return null

  const item = sub.items?.data?.[0]
  const periodEndSec = sub.current_period_end ?? item?.current_period_end ?? null
  return {
    kind,
    targetId,
    customerId,
    subscriptionId: sub.id,
    priceId: item?.price?.id ?? null,
    status: sub.status,
    periodEnd: periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    maxPractitioners: kind === 'clinic' ? parseMaxPractitioners(sub.metadata?.max_practitioners) : null,
    quoteId: sub.metadata?.quote_id || null,
  }
}

// --- Session de paiement (Checkout) ------------------------------------------

export interface CheckoutInput {
  customerId: string
  priceId: string
  kind: SubscriptionKind
  targetId: string
  userId: string
  successUrl: string
  cancelUrl: string
  // Calcul automatique de la TVA par Stripe (Stripe Tax) : activé seulement une
  // fois la TVA confirmée et Stripe Tax configuré, voir STRIPE_AUTOMATIC_TAX.
  automaticTax?: boolean
}

export function buildCheckoutParams(i: CheckoutInput): URLSearchParams {
  const p = new URLSearchParams()
  p.set('mode', 'subscription')
  p.set('customer', i.customerId)
  p.set('line_items[0][price]', i.priceId)
  p.set('line_items[0][quantity]', '1')
  p.set('success_url', i.successUrl)
  p.set('cancel_url', i.cancelUrl)
  p.set('client_reference_id', i.userId)
  p.set('locale', 'fr')
  // Praticiens = professionnels : adresse de facturation obligatoire et numéro de
  // TVA facultatif (apparaît sur la facture).
  p.set('billing_address_collection', 'required')
  p.set('tax_id_collection[enabled]', 'true')
  p.set('customer_update[address]', 'auto')
  p.set('customer_update[name]', 'auto')
  // Le lien offre ↔ abonnement voyage dans les métadonnées de l'abonnement, ce qui
  // permet au webhook de savoir qui est concerné pour chaque événement ultérieur.
  p.set('metadata[kind]', i.kind)
  p.set('metadata[target_id]', i.targetId)
  p.set('subscription_data[metadata][kind]', i.kind)
  p.set('subscription_data[metadata][target_id]', i.targetId)
  p.set('subscription_data[metadata][user_id]', i.userId)
  if (i.automaticTax) p.set('automatic_tax[enabled]', 'true')
  return p
}

// --- Paiement au prix d'un devis « grand cabinet » ----------------------------

export interface QuoteCheckoutInput {
  customerId: string
  priceCents: number // HT par mois
  maxPractitioners: number
  clinicId: string
  userId: string
  quoteId: string
  successUrl: string
  cancelUrl: string
  automaticTax?: boolean
}

// Même session que buildCheckoutParams, mais le prix est fixé ici (prix « à la volée »)
// au lieu d'un STRIPE_PRICE_*. Les métadonnées portent le cabinet, sa limite de praticiens
// et la demande : le webhook en déduit tout, sans état côté site.
export function buildQuoteCheckoutParams(i: QuoteCheckoutInput): URLSearchParams {
  const p = new URLSearchParams()
  p.set('mode', 'subscription')
  p.set('customer', i.customerId)
  p.set('line_items[0][price_data][currency]', 'eur')
  p.set('line_items[0][price_data][unit_amount]', String(i.priceCents))
  p.set('line_items[0][price_data][recurring][interval]', 'month')
  p.set('line_items[0][price_data][tax_behavior]', 'exclusive')
  p.set('line_items[0][price_data][product_data][name]', `Abonnement Animéaux — Grand cabinet (${i.maxPractitioners} praticiens)`)
  p.set('line_items[0][price_data][product_data][description]', "Accès de toute l'équipe du cabinet à l'ensemble des fonctionnalités d'Animéaux")
  p.set('line_items[0][quantity]', '1')
  p.set('success_url', i.successUrl)
  p.set('cancel_url', i.cancelUrl)
  p.set('client_reference_id', i.userId)
  p.set('locale', 'fr')
  p.set('billing_address_collection', 'required')
  p.set('tax_id_collection[enabled]', 'true')
  p.set('customer_update[address]', 'auto')
  p.set('customer_update[name]', 'auto')
  for (const prefix of ['metadata', 'subscription_data[metadata]']) {
    p.set(`${prefix}[kind]`, 'clinic')
    p.set(`${prefix}[target_id]`, i.clinicId)
    p.set(`${prefix}[user_id]`, i.userId)
    p.set(`${prefix}[quote_id]`, i.quoteId)
    p.set(`${prefix}[max_practitioners]`, String(i.maxPractitioners))
  }
  if (i.automaticTax) p.set('automatic_tax[enabled]', 'true')
  return p
}

export interface QuoteLinkRow {
  user_id: string
  offer_price_cents: number | null
  offer_max_practitioners: number | null
  paid_at: string | null
}

export type QuoteLinkCheck =
  | { ok: true; priceCents: number; maxPractitioners: number }
  | { ok: false; code: 'quote_not_found' | 'not_your_quote' | 'already_paid' | 'link_disabled' }

// Ce lien peut-il ouvrir une page de paiement pour cette personne ? Seule la personne qui a
// fait la demande peut payer, et une seule fois ; une offre incomplète est refusée.
export function checkQuoteLink(row: QuoteLinkRow | null | undefined, userId: string): QuoteLinkCheck {
  if (!row) return { ok: false, code: 'quote_not_found' }
  if (row.user_id !== userId) return { ok: false, code: 'not_your_quote' }
  if (row.paid_at) return { ok: false, code: 'already_paid' }
  if (!row.offer_price_cents || !row.offer_max_practitioners) return { ok: false, code: 'link_disabled' }
  return { ok: true, priceCents: row.offer_price_cents, maxPractitioners: row.offer_max_practitioners }
}

// Forme attendue du jeton du lien (64 caractères hexadécimaux) : évite d'interroger la base
// avec n'importe quoi.
export function isQuoteToken(token: unknown): token is string {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)
}

// --- Signature du webhook -----------------------------------------------------

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Comparaison à durée constante (évite de révéler la signature attendue par le
// temps de réponse).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Vérifie l'en-tête `Stripe-Signature` ("t=…,v1=…") : HMAC-SHA256 de "t.payload"
// avec le secret du endpoint, et horodatage pas trop ancien (rejeu).
export async function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false
  let timestamp: string | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=')
    if (k?.trim() === 't') timestamp = v?.trim() ?? null
    if (k?.trim() === 'v1' && v) signatures.push(v.trim())
  }
  if (!timestamp || signatures.length === 0) return false
  const t = Number(timestamp)
  if (!Number.isFinite(t) || Math.abs(nowSec - t) > toleranceSec) return false

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  return signatures.some(s => safeEqual(s, expected))
}

export const SUBSCRIPTION_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const
