import { describe, it, expect } from 'vitest'
import { CONTACT_EMAIL } from './doctorPlan'
import { NOTIFY_EMAIL_DEFAULT } from '../../supabase/functions/request-cabinet-quote/quote'
import { QUOTE_ERRORS, quoteErrorMessage, validateQuoteRequest, QUOTE_STATUS_LABEL, QUOTE_STATUS_ORDER } from './cabinetQuote'

describe('cabinetQuote', () => {
  it('chaque erreur de validation a un message en français', () => {
    const codes = ['clinic_name_required', 'practitioner_count_invalid', 'too_few_practitioners', 'next_year_invalid',
      'secretary_count_invalid', 'phone_invalid', 'consent_required', 'too_long'] as const
    for (const code of codes) expect(QUOTE_ERRORS[code].length).toBeGreaterThan(10)
  })

  it('renvoie vers l\'abonnement cabinet pour 5 praticiens ou moins', () => {
    const r = validateQuoteRequest({ clinicName: 'X', practitionerCount: 4, consent: true })
    expect(r).toEqual({ ok: false, error: 'too_few_practitioners' })
    expect(QUOTE_ERRORS.too_few_practitioners).toMatch(/5 praticiens ou moins/)
  })

  it('un code inconnu ou absent donne le message générique', () => {
    expect(quoteErrorMessage('bizarre')).toBe(QUOTE_ERRORS.internal)
    expect(quoteErrorMessage(undefined)).toBe(QUOTE_ERRORS.internal)
    expect(quoteErrorMessage('too_many_requests')).toBe(QUOTE_ERRORS.too_many_requests)
  })

  it('tous les statuts ont un libellé et un ordre', () => {
    expect(QUOTE_STATUS_ORDER).toEqual(['new', 'quote_sent', 'accepted', 'declined'])
    for (const s of QUOTE_STATUS_ORDER) expect(QUOTE_STATUS_LABEL[s]).toBeTruthy()
  })

  it("l'adresse affichée dans l'application est celle où arrivent les demandes de devis", () => {
    expect(CONTACT_EMAIL).toBe(NOTIFY_EMAIL_DEFAULT)
  })
})
