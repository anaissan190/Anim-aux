// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  isPaidStatus, kindForPlan, priceIdForPlan, extractSubscriptionState, buildCheckoutParams,
  verifyStripeSignature, SUBSCRIPTION_EVENTS, checkBillingConfig, checkStripeSecret, parseMaxPractitioners,
  buildQuoteCheckoutParams, checkQuoteLink, isQuoteToken,
} from './billing'

describe('isPaidStatus', () => {
  it("donne accès pendant l'abonnement actif, l'essai et la relance d'un prélèvement échoué", () => {
    for (const s of ['active', 'trialing', 'past_due']) expect(isPaidStatus(s)).toBe(true)
  })
  it("coupe l'accès pour un abonnement résilié, impayé ou jamais finalisé", () => {
    for (const s of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', '', null, undefined]) {
      expect(isPaidStatus(s as any)).toBe(false)
    }
  })
})

describe('kindForPlan / priceIdForPlan', () => {
  it("rattache l'abonnement individuel au praticien et l'abonnement cabinet au cabinet", () => {
    expect(kindForPlan('pro')).toBe('doctor')
    expect(kindForPlan('cabinet')).toBe('clinic')
  })
  it('lit les identifiants de prix dans les secrets, et renvoie null tant que ce n\'est pas configuré', () => {
    const env = { STRIPE_PRICE_PRO: ' price_pro ', STRIPE_PRICE_CABINET: 'price_cab' }
    expect(priceIdForPlan('pro', env)).toBe('price_pro')
    expect(priceIdForPlan('cabinet', env)).toBe('price_cab')
    expect(priceIdForPlan('pro', {})).toBeNull()
    expect(priceIdForPlan('cabinet', { STRIPE_PRICE_CABINET: '   ' })).toBeNull()
    expect(priceIdForPlan('inconnu', env)).toBeNull()
  })
})

describe('extractSubscriptionState', () => {
  const base = {
    id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false,
    current_period_end: 1_800_000_000,
    items: { data: [{ price: { id: 'price_pro' } }] },
    metadata: { kind: 'doctor', target_id: 'doc-1' },
  }

  it("extrait l'état à enregistrer (ancienne forme d'API : fin de période sur l'abonnement)", () => {
    expect(extractSubscriptionState(base)).toEqual({
      kind: 'doctor', targetId: 'doc-1', customerId: 'cus_1', subscriptionId: 'sub_1', priceId: 'price_pro',
      status: 'active', periodEnd: new Date(1_800_000_000 * 1000).toISOString(), cancelAtPeriodEnd: false,
      maxPractitioners: null, quoteId: null,
    })
  })

  it("lit la limite de praticiens et la demande d'un abonnement au prix d'un devis (cabinet seulement)", () => {
    const clinic = {
      ...base, metadata: { kind: 'clinic', target_id: 'clinic-1', max_practitioners: '8', quote_id: 'q-1', user_id: 'u-1' },
    }
    expect(extractSubscriptionState(clinic)).toMatchObject({ kind: 'clinic', maxPractitioners: 8, quoteId: 'q-1' })
    // un abonnement individuel ne porte jamais de limite de cabinet
    expect(extractSubscriptionState({ ...base, metadata: { kind: 'doctor', target_id: 'd-1', max_practitioners: '8' } })?.maxPractitioners).toBeNull()
  })

  it("accepte la forme récente de l'API : fin de période sur la ligne d'abonnement, client en objet", () => {
    const s = extractSubscriptionState({
      ...base, current_period_end: undefined, customer: { id: 'cus_9' },
      items: { data: [{ price: { id: 'price_cab' }, current_period_end: 1_900_000_000 }] },
      metadata: { kind: 'clinic', target_id: 'clinic-1' }, cancel_at_period_end: true,
    })
    expect(s?.customerId).toBe('cus_9')
    expect(s?.kind).toBe('clinic')
    expect(s?.periodEnd).toBe(new Date(1_900_000_000 * 1000).toISOString())
    expect(s?.cancelAtPeriodEnd).toBe(true)
  })

  it("renvoie null sans lien vers un praticien/cabinet, sans client ou sans identifiant (rien à recopier)", () => {
    expect(extractSubscriptionState({ ...base, metadata: {} })).toBeNull()
    expect(extractSubscriptionState({ ...base, metadata: { kind: 'autre', target_id: 'x' } })).toBeNull()
    expect(extractSubscriptionState({ ...base, metadata: { kind: 'doctor' } })).toBeNull()
    expect(extractSubscriptionState({ ...base, customer: null })).toBeNull()
    expect(extractSubscriptionState({ ...base, id: undefined })).toBeNull()
    expect(extractSubscriptionState(null)).toBeNull()
  })

  it('gère une fin de période absente', () => {
    expect(extractSubscriptionState({ ...base, current_period_end: null })?.periodEnd).toBeNull()
  })
})

describe('buildCheckoutParams', () => {
  const input = {
    customerId: 'cus_1', priceId: 'price_pro', kind: 'doctor' as const, targetId: 'doc-1', userId: 'u-1',
    successUrl: 'https://monanimeaux.fr/abonnement?paiement=succes', cancelUrl: 'https://monanimeaux.fr/abonnement?paiement=annule',
  }

  it("crée un abonnement pour le bon client et le bon prix, en français", () => {
    const p = buildCheckoutParams(input)
    expect(p.get('mode')).toBe('subscription')
    expect(p.get('customer')).toBe('cus_1')
    expect(p.get('line_items[0][price]')).toBe('price_pro')
    expect(p.get('line_items[0][quantity]')).toBe('1')
    expect(p.get('locale')).toBe('fr')
    expect(p.get('success_url')).toBe(input.successUrl)
    expect(p.get('cancel_url')).toBe(input.cancelUrl)
  })

  it("exige l'adresse de facturation et propose le numéro de TVA (clients professionnels)", () => {
    const p = buildCheckoutParams(input)
    expect(p.get('billing_address_collection')).toBe('required')
    expect(p.get('tax_id_collection[enabled]')).toBe('true')
  })

  it("porte le lien abonnement ↔ praticien/cabinet dans les métadonnées de l'abonnement", () => {
    const p = buildCheckoutParams({ ...input, kind: 'clinic', targetId: 'clinic-1' })
    expect(p.get('subscription_data[metadata][kind]')).toBe('clinic')
    expect(p.get('subscription_data[metadata][target_id]')).toBe('clinic-1')
    expect(p.get('subscription_data[metadata][user_id]')).toBe('u-1')
  })

  it("n'active le calcul automatique de TVA que sur demande", () => {
    expect(buildCheckoutParams(input).get('automatic_tax[enabled]')).toBeNull()
    expect(buildCheckoutParams({ ...input, automaticTax: true }).get('automatic_tax[enabled]')).toBe('true')
  })
})

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test_secret'
  const payload = '{"id":"evt_1","type":"customer.subscription.updated"}'
  const now = 1_800_000_000

  async function sign(body: string, ts: number, key = secret) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${ts}.${body}`))
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  it('accepte une signature valide récente', async () => {
    const header = `t=${now},v1=${await sign(payload, now)}`
    expect(await verifyStripeSignature(payload, header, secret, 300, now)).toBe(true)
  })

  it("accepte l'une des signatures quand Stripe en envoie plusieurs (rotation du secret)", async () => {
    const header = `t=${now},v1=${'0'.repeat(64)},v1=${await sign(payload, now)}`
    expect(await verifyStripeSignature(payload, header, secret, 300, now)).toBe(true)
  })

  it('refuse un contenu modifié, un mauvais secret ou une signature absente', async () => {
    const header = `t=${now},v1=${await sign(payload, now)}`
    expect(await verifyStripeSignature(payload + ' ', header, secret, 300, now)).toBe(false)
    expect(await verifyStripeSignature(payload, header, 'whsec_autre', 300, now)).toBe(false)
    expect(await verifyStripeSignature(payload, null, secret, 300, now)).toBe(false)
    expect(await verifyStripeSignature(payload, `t=${now}`, secret, 300, now)).toBe(false)
    expect(await verifyStripeSignature(payload, `v1=${await sign(payload, now)}`, secret, 300, now)).toBe(false)
    expect(await verifyStripeSignature(payload, 'n importe quoi', secret, 300, now)).toBe(false)
  })

  it('refuse un événement trop ancien (rejeu) ou venant du futur', async () => {
    const old = now - 3600
    expect(await verifyStripeSignature(payload, `t=${old},v1=${await sign(payload, old)}`, secret, 300, now)).toBe(false)
    const future = now + 3600
    expect(await verifyStripeSignature(payload, `t=${future},v1=${await sign(payload, future)}`, secret, 300, now)).toBe(false)
  })

  it('refuse sans secret configuré', async () => {
    expect(await verifyStripeSignature(payload, `t=${now},v1=abc`, '', 300, now)).toBe(false)
  })
})

describe('SUBSCRIPTION_EVENTS', () => {
  it("écoute la création, la mise à jour et la fin d'un abonnement", () => {
    expect([...SUBSCRIPTION_EVENTS]).toEqual([
      'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
    ])
  })
})

describe('checkBillingConfig', () => {
  const good = { STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_PRICE_PRO: 'price_pro', STRIPE_PRICE_CABINET: 'price_cab' }

  it('accepte une configuration complète et renvoie le bon prix selon l\'offre', () => {
    expect(checkBillingConfig('pro', good)).toEqual({ ok: true, secretKey: 'sk_test_abc', priceId: 'price_pro' })
    expect(checkBillingConfig('cabinet', good)).toEqual({ ok: true, secretKey: 'sk_test_abc', priceId: 'price_cab' })
  })

  it('accepte une clé restreinte et une clé réelle, en ignorant les espaces autour', () => {
    expect(checkBillingConfig('pro', { ...good, STRIPE_SECRET_KEY: ' rk_live_abc ' }).ok).toBe(true)
    expect(checkBillingConfig('pro', { ...good, STRIPE_PRICE_PRO: ' price_pro ' })).toMatchObject({ ok: true, priceId: 'price_pro' })
  })

  it('distingue « pas encore configuré » (secret absent) de « mal configuré »', () => {
    expect(checkBillingConfig('pro', {})).toMatchObject({ ok: false, code: 'billing_not_configured', problem: expect.stringMatching(/STRIPE_SECRET_KEY/) })
    expect(checkBillingConfig('pro', { STRIPE_SECRET_KEY: 'sk_test_abc' })).toMatchObject({ ok: false, code: 'billing_not_configured', problem: expect.stringMatching(/STRIPE_PRICE_PRO/) })
    expect(checkBillingConfig('cabinet', { ...good, STRIPE_PRICE_CABINET: '  ' })).toMatchObject({ ok: false, code: 'billing_not_configured', problem: expect.stringMatching(/STRIPE_PRICE_CABINET/) })
  })

  it('repère la clé publiable collée à la place de la clé secrète', () => {
    expect(checkBillingConfig('pro', { ...good, STRIPE_SECRET_KEY: 'pk_test_abc' })).toMatchObject({
      ok: false, code: 'billing_misconfigured', problem: expect.stringMatching(/PUBLIABLE/),
    })
  })

  it('repère un secret qui n\'est pas une clé Stripe', () => {
    expect(checkBillingConfig('pro', { ...good, STRIPE_SECRET_KEY: 'whsec_abc' })).toMatchObject({ ok: false, code: 'billing_misconfigured' })
  })

  it("repère un identifiant de produit (prod_) collé à la place de l'identifiant de prix (price_)", () => {
    expect(checkBillingConfig('pro', { ...good, STRIPE_PRICE_PRO: 'prod_ABC123' })).toMatchObject({
      ok: false, code: 'billing_misconfigured', problem: expect.stringMatching(/PRODUIT.*PRIX/),
    })
    expect(checkBillingConfig('pro', { ...good, STRIPE_PRICE_PRO: 'abc' })).toMatchObject({ ok: false, code: 'billing_misconfigured' })
  })

  it('ne regarde que le prix de l\'offre demandée', () => {
    expect(checkBillingConfig('cabinet', { ...good, STRIPE_PRICE_PRO: 'prod_oops' }).ok).toBe(true)
  })

  it('refuse une offre inconnue', () => {
    expect(checkBillingConfig('autre', good)).toMatchObject({ ok: false, code: 'billing_not_configured' })
  })
})

describe('parseMaxPractitioners', () => {
  it('accepte un entier de 5 à 200 et ignore tout le reste', () => {
    expect(parseMaxPractitioners('5')).toBe(5)
    expect(parseMaxPractitioners('8')).toBe(8)
    expect(parseMaxPractitioners('200')).toBe(200)
    for (const bad of ['4', '201', '0', '-3', '8.5', 'huit', '', ' 8', null, undefined]) {
      expect(parseMaxPractitioners(bad as any)).toBeNull()
    }
  })
})

describe('checkStripeSecret', () => {
  it('accepte une clé secrète, de test ou réelle, sans se soucier des espaces', () => {
    expect(checkStripeSecret({ STRIPE_SECRET_KEY: ' sk_test_abc ' })).toEqual({ ok: true, secretKey: 'sk_test_abc' })
    expect(checkStripeSecret({ STRIPE_SECRET_KEY: 'rk_live_abc' }).ok).toBe(true)
  })
  it('distingue absente, publiable et inconnue', () => {
    expect(checkStripeSecret({})).toMatchObject({ ok: false, code: 'billing_not_configured' })
    expect(checkStripeSecret({ STRIPE_SECRET_KEY: 'pk_test_abc' })).toMatchObject({ ok: false, code: 'billing_misconfigured', problem: expect.stringMatching(/PUBLIABLE/) })
    expect(checkStripeSecret({ STRIPE_SECRET_KEY: 'whsec_abc' })).toMatchObject({ ok: false, code: 'billing_misconfigured' })
  })
})

describe('buildQuoteCheckoutParams', () => {
  const input = {
    customerId: 'cus_1', priceCents: 15560, maxPractitioners: 8, clinicId: 'clinic-1', userId: 'user-1', quoteId: 'quote-1',
    successUrl: 'https://x/ok', cancelUrl: 'https://x/ko',
  }
  const p = buildQuoteCheckoutParams(input)

  it("crée un abonnement mensuel au prix du devis, en euros hors taxes", () => {
    expect(p.get('mode')).toBe('subscription')
    expect(p.get('customer')).toBe('cus_1')
    expect(p.get('line_items[0][price_data][unit_amount]')).toBe('15560')
    expect(p.get('line_items[0][price_data][currency]')).toBe('eur')
    expect(p.get('line_items[0][price_data][recurring][interval]')).toBe('month')
    expect(p.get('line_items[0][price_data][tax_behavior]')).toBe('exclusive')
    expect(p.get('line_items[0][price_data][product_data][name]')).toBe('Abonnement Animéaux — Grand cabinet (8 praticiens)')
    expect(p.get('line_items[0][quantity]')).toBe('1')
    expect(p.has('line_items[0][price]')).toBe(false)
  })

  it("porte cabinet, limite et demande sur la session ET sur l'abonnement (le webhook les relit)", () => {
    for (const prefix of ['metadata', 'subscription_data[metadata]']) {
      expect(p.get(`${prefix}[kind]`)).toBe('clinic')
      expect(p.get(`${prefix}[target_id]`)).toBe('clinic-1')
      expect(p.get(`${prefix}[user_id]`)).toBe('user-1')
      expect(p.get(`${prefix}[quote_id]`)).toBe('quote-1')
      expect(p.get(`${prefix}[max_practitioners]`)).toBe('8')
    }
  })

  it("demande l'adresse de facturation et le numéro de TVA, comme l'abonnement normal", () => {
    expect(p.get('billing_address_collection')).toBe('required')
    expect(p.get('tax_id_collection[enabled]')).toBe('true')
    expect(p.get('locale')).toBe('fr')
    expect(p.has('automatic_tax[enabled]')).toBe(false)
    expect(buildQuoteCheckoutParams({ ...input, automaticTax: true }).get('automatic_tax[enabled]')).toBe('true')
  })

  it("l'abonnement produit un état lisible par le webhook, avec la limite du devis", () => {
    const sub = {
      id: 'sub_q', status: 'active', customer: 'cus_1',
      metadata: Object.fromEntries([...p.entries()].filter(([k]) => k.startsWith('subscription_data[metadata]')).map(([k, v]) => [k.slice('subscription_data[metadata]['.length, -1), v])),
    }
    expect(extractSubscriptionState(sub)).toMatchObject({ kind: 'clinic', targetId: 'clinic-1', maxPractitioners: 8, quoteId: 'quote-1' })
  })
})

describe('checkQuoteLink', () => {
  const row = { user_id: 'u1', offer_price_cents: 15560, offer_max_practitioners: 8, paid_at: null }

  it("autorise la personne qui a fait la demande, avec le prix et la limite du devis", () => {
    expect(checkQuoteLink(row, 'u1')).toEqual({ ok: true, priceCents: 15560, maxPractitioners: 8 })
  })
  it("refuse un lien inconnu, celui de quelqu'un d'autre, une demande déjà payée ou une offre incomplète", () => {
    expect(checkQuoteLink(null, 'u1')).toEqual({ ok: false, code: 'quote_not_found' })
    expect(checkQuoteLink(undefined, 'u1')).toEqual({ ok: false, code: 'quote_not_found' })
    expect(checkQuoteLink(row, 'u2')).toEqual({ ok: false, code: 'not_your_quote' })
    expect(checkQuoteLink({ ...row, paid_at: '2026-10-16T10:00:00Z' }, 'u1')).toEqual({ ok: false, code: 'already_paid' })
    expect(checkQuoteLink({ ...row, offer_price_cents: null }, 'u1')).toEqual({ ok: false, code: 'link_disabled' })
    expect(checkQuoteLink({ ...row, offer_max_practitioners: null }, 'u1')).toEqual({ ok: false, code: 'link_disabled' })
  })
  it("vérifie la forme du jeton avant toute requête", () => {
    expect(isQuoteToken('a'.repeat(64))).toBe(true)
    for (const bad of ['', 'a'.repeat(63), 'A'.repeat(64), 'g'.repeat(64), `${'a'.repeat(63)}'`, null, undefined, 12]) {
      expect(isQuoteToken(bad)).toBe(false)
    }
  })
})
