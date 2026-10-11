import { describe, it, expect } from 'vitest'
import { hasProFeatures, otherPlan, PLAN_LABEL } from './doctorPlan'

describe('hasProFeatures', () => {
  it("donne accès à tout à un praticien en abonnement", () => {
    expect(hasProFeatures({ plan: 'pro' })).toBe(true)
  })

  it("restreint un praticien en offre gratuite", () => {
    expect(hasProFeatures({ plan: 'free' })).toBe(false)
  })

  it("ne retire rien sur une valeur absente (cache d'avant la migration)", () => {
    expect(hasProFeatures({})).toBe(true)
    expect(hasProFeatures({ plan: null })).toBe(true)
    expect(hasProFeatures(null)).toBe(true)
    expect(hasProFeatures(undefined)).toBe(true)
  })
})

describe('otherPlan', () => {
  it("bascule d'une offre à l'autre", () => {
    expect(otherPlan('free')).toBe('pro')
    expect(otherPlan('pro')).toBe('free')
  })
})

describe('PLAN_LABEL', () => {
  it("nomme les deux offres", () => {
    expect(PLAN_LABEL.free).toBe('Offre gratuite')
    expect(PLAN_LABEL.pro).toBe('Abonnement')
  })
})
