import { describe, it, expect } from 'vitest'
import {
  PLAN_OFFERS, billingErrorMessage, BILLING_ERRORS, paymentReturnFromSearch, currentSubscription,
  describeSubscription, blocksAccountDeletion,
} from './subscription'

describe('PLAN_OFFERS', () => {
  it('reprend les prix décidés, hors taxe', () => {
    expect(PLAN_OFFERS.free.priceHt).toBeNull()
    expect(PLAN_OFFERS.pro.priceHt).toBe('39,90')
    expect(PLAN_OFFERS.cabinet.priceHt).toBe('95,90')
  })

  it("l'offre gratuite n'inclut ni réservation, ni agenda, ni messagerie, ni statistiques", () => {
    const excluded = PLAN_OFFERS.free.features.filter(f => !f.included).map(f => f.label)
    expect(excluded).toEqual(expect.arrayContaining(['Réservation en ligne', 'Agenda et rappels', 'Messagerie patients', 'Dossiers et statistiques']))
  })

  it("les offres payantes n'excluent rien et le cabinet annonce ses 5 praticiens", () => {
    for (const id of ['pro', 'cabinet'] as const) {
      expect(PLAN_OFFERS[id].features.every(f => f.included)).toBe(true)
    }
    expect(PLAN_OFFERS.cabinet.tagline).toMatch(/5 praticiens/)
  })
})

describe('billingErrorMessage', () => {
  it('traduit chaque code connu et retombe sur un message neutre sinon', () => {
    for (const code of Object.keys(BILLING_ERRORS)) expect(billingErrorMessage(code).length).toBeGreaterThan(5)
    expect(billingErrorMessage('billing_not_configured')).toMatch(/pas encore ouvert/)
    expect(billingErrorMessage('code_inconnu')).toBe(BILLING_ERRORS.internal)
    expect(billingErrorMessage(null)).toBe(BILLING_ERRORS.internal)
    expect(billingErrorMessage(undefined)).toBe(BILLING_ERRORS.internal)
  })
})

describe('paymentReturnFromSearch', () => {
  it('lit le retour de la page de paiement', () => {
    expect(paymentReturnFromSearch('?paiement=succes')).toBe('success')
    expect(paymentReturnFromSearch('?paiement=annule')).toBe('cancelled')
    expect(paymentReturnFromSearch('?paiement=autre')).toBeNull()
    expect(paymentReturnFromSearch('')).toBeNull()
    expect(paymentReturnFromSearch('?x=1&paiement=succes')).toBe('success')
  })
})

describe('currentSubscription', () => {
  it('privilégie un abonnement payant même s\'il est plus ancien qu\'un abonnement terminé', () => {
    const rows = [
      { status: 'canceled', current_period_end: null, cancel_at_period_end: false, created_at: '2026-10-05' },
      { status: 'active', current_period_end: '2026-12-01', cancel_at_period_end: false, created_at: '2026-09-01' },
    ]
    expect(currentSubscription(rows)?.status).toBe('active')
  })
  it('prend le plus récent quand aucun n\'est payant, et null sans ligne', () => {
    const rows = [
      { status: 'canceled', current_period_end: null, cancel_at_period_end: false, created_at: '2026-01-01' },
      { status: 'incomplete_expired', current_period_end: null, cancel_at_period_end: false, created_at: '2026-02-01' },
    ]
    expect(currentSubscription(rows)?.status).toBe('incomplete_expired')
    expect(currentSubscription([])).toBeNull()
    expect(currentSubscription(null)).toBeNull()
  })
})

describe('describeSubscription', () => {
  const end = '2026-12-01T10:00:00Z'
  it('un abonnement actif annonce son renouvellement', () => {
    const d = describeSubscription({ status: 'active', current_period_end: end, cancel_at_period_end: false })
    expect(d.tone).toBe('ok')
    expect(d.text).toMatch(/prochain renouvellement le 1 décembre 2026/)
  })
  it('une résiliation programmée annonce la date de fin', () => {
    const d = describeSubscription({ status: 'active', current_period_end: end, cancel_at_period_end: true })
    expect(d.tone).toBe('warning')
    expect(d.text).toMatch(/Résilié.*1 décembre 2026/)
  })
  it('un paiement en échec demande de mettre la carte à jour', () => {
    const d = describeSubscription({ status: 'past_due', current_period_end: end, cancel_at_period_end: false })
    expect(d.tone).toBe('warning')
    expect(d.text).toMatch(/carte/)
  })
  it('sans abonnement Stripe, parle d\'abonnement offert ; un abonnement fini est signalé', () => {
    expect(describeSubscription(null).text).toMatch(/offert/)
    expect(describeSubscription({ status: 'canceled', current_period_end: null, cancel_at_period_end: false }).text).toMatch(/terminé/)
  })
  it('reste correct sans date de fin', () => {
    expect(describeSubscription({ status: 'active', current_period_end: null, cancel_at_period_end: false }).text).toBe('Actif.')
  })
})

describe('blocksAccountDeletion', () => {
  it('bloque tant qu\'un abonnement actif n\'est pas résilié', () => {
    expect(blocksAccountDeletion([{ status: 'active', current_period_end: null, cancel_at_period_end: false }])).toBe(true)
    expect(blocksAccountDeletion([{ status: 'past_due', current_period_end: null, cancel_at_period_end: false }])).toBe(true)
  })
  it('ne bloque plus une fois la résiliation programmée, ni sans abonnement', () => {
    expect(blocksAccountDeletion([{ status: 'active', current_period_end: null, cancel_at_period_end: true }])).toBe(false)
    expect(blocksAccountDeletion([{ status: 'canceled', current_period_end: null, cancel_at_period_end: false }])).toBe(false)
    expect(blocksAccountDeletion([])).toBe(false)
    expect(blocksAccountDeletion(null)).toBe(false)
  })
})
