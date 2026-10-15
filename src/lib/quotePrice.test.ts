import { describe, it, expect } from 'vitest'
import {
  suggestedMonthlyCents, formatCents, parseEuros, quotePaymentUrl, CABINET_BASE_CENTS, EXTRA_PRACTITIONER_CENTS, validateOffer,
} from './quotePrice'
import { PLAN_OFFERS } from './subscription'

describe('suggestedMonthlyCents', () => {
  it("reprend les exemples du devis : 95,90 € + 19,90 € par praticien au-delà de 5", () => {
    expect(suggestedMonthlyCents(5)).toBe(9590)
    expect(suggestedMonthlyCents(6)).toBe(11580)
    expect(suggestedMonthlyCents(8)).toBe(15560)
    expect(suggestedMonthlyCents(10)).toBe(19540)
    expect(suggestedMonthlyCents(15)).toBe(29490)
  })
  it("ne descend jamais sous le prix du cabinet de base", () => {
    expect(suggestedMonthlyCents(1)).toBe(CABINET_BASE_CENTS)
    expect(suggestedMonthlyCents(0)).toBe(CABINET_BASE_CENTS)
    expect(suggestedMonthlyCents(7.9)).toBe(CABINET_BASE_CENTS + 2 * EXTRA_PRACTITIONER_CENTS)
  })
  it("le prix de base est bien celui de l'abonnement cabinet affiché à l'écran", () => {
    expect(formatCents(CABINET_BASE_CENTS)).toBe(`${PLAN_OFFERS.cabinet.priceHt} €`)
  })
})

describe('formatCents / parseEuros', () => {
  it('écrit les montants à la française', () => {
    expect(formatCents(15560)).toBe('155,60 €')
    expect(formatCents(9590)).toBe('95,90 €')
    expect(formatCents(1000)).toBe('10,00 €')
    expect(formatCents(5)).toBe('0,05 €')
  })
  it('lit un prix saisi avec virgule, point, espaces ou symbole euro', () => {
    expect(parseEuros('155,60')).toBe(15560)
    expect(parseEuros('155.6')).toBe(15560)
    expect(parseEuros(' 155 € ')).toBe(15500)
    expect(parseEuros('1 250,5')).toBe(125050)
  })
  it("refuse ce qui n'est pas un prix", () => {
    for (const bad of ['', 'abc', '12,345', '-5', '1,2,3', '12 e']) expect(parseEuros(bad)).toBeNull()
  })
  it('un prix écrit puis relu donne le même nombre de centimes', () => {
    for (const cents of [1000, 9590, 15560, 29490]) expect(parseEuros(formatCents(cents))).toBe(cents)
  })
})

describe('quotePaymentUrl', () => {
  it("construit le lien envoyé au cabinet", () => {
    expect(quotePaymentUrl('abc')).toBe('https://monanimeaux.fr/paiement-devis/abc')
    expect(quotePaymentUrl('abc', 'http://localhost:3000')).toBe('http://localhost:3000/paiement-devis/abc')
  })
})

describe('validateOffer', () => {
  it("accepte une offre complète et la convertit (limite en entier, prix en centimes)", () => {
    expect(validateOffer('8', '155,60')).toEqual({ ok: true, maxPractitioners: 8, priceCents: 15560 })
    expect(validateOffer(' 6 ', '115.8')).toEqual({ ok: true, maxPractitioners: 6, priceCents: 11580 })
    expect(validateOffer('200', '10 000')).toEqual({ ok: true, maxPractitioners: 200, priceCents: 1_000_000 })
  })
  it("refuse un nombre de praticiens hors bornes ou non entier", () => {
    for (const bad of ['', '5', '201', '8.5', 'huit', '-8']) expect(validateOffer(bad, '155,60').ok).toBe(false)
    expect(validateOffer('5', '155,60')).toMatchObject({ ok: false, error: expect.stringMatching(/entre 6 et 200/) })
  })
  it("refuse un prix absent, illisible ou hors bornes", () => {
    expect(validateOffer('8', '')).toMatchObject({ ok: false, error: expect.stringMatching(/prix mensuel/) })
    expect(validateOffer('8', 'abc').ok).toBe(false)
    expect(validateOffer('8', '9,99')).toMatchObject({ ok: false, error: expect.stringMatching(/entre 10 et 10 000/) })
    expect(validateOffer('8', '10 000,01').ok).toBe(false)
  })
})
