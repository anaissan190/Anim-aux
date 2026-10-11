import { describe, it, expect } from 'vitest'
import {
  hasProFeatures, otherPlan, otherClinicPlan, clinicSeatsLeft, PLAN_LABEL, CLINIC_PLAN_LABEL,
  MAX_CLINIC_PRACTITIONERS,
} from './doctorPlan'

describe('hasProFeatures', () => {
  it("donne accès à tout à un praticien en abonnement", () => {
    expect(hasProFeatures({ plan: 'pro' })).toBe(true)
  })

  it("restreint un praticien en offre gratuite sans cabinet", () => {
    expect(hasProFeatures({ plan: 'free' })).toBe(false)
    expect(hasProFeatures({ plan: 'free' }, null)).toBe(false)
    expect(hasProFeatures({ plan: 'free' }, undefined)).toBe(false)
  })

  it("donne accès à tout à un praticien gratuit membre d'un cabinet abonné", () => {
    expect(hasProFeatures({ plan: 'free' }, { plan: 'cabinet' })).toBe(true)
  })

  it("ne donne rien à un praticien gratuit membre d'un cabinet non activé", () => {
    expect(hasProFeatures({ plan: 'free' }, { plan: 'free' })).toBe(false)
  })

  it("ne retire rien sur une valeur absente (cache d'avant la migration)", () => {
    expect(hasProFeatures({})).toBe(true)
    expect(hasProFeatures({ plan: null })).toBe(true)
    expect(hasProFeatures(null)).toBe(true)
    expect(hasProFeatures(undefined)).toBe(true)
  })
})

describe('otherPlan / otherClinicPlan', () => {
  it("bascule d'une offre à l'autre", () => {
    expect(otherPlan('free')).toBe('pro')
    expect(otherPlan('pro')).toBe('free')
    expect(otherClinicPlan('free')).toBe('cabinet')
    expect(otherClinicPlan('cabinet')).toBe('free')
  })
})

describe('clinicSeatsLeft', () => {
  it("compte les places restantes d'un cabinet abonné (5 praticiens)", () => {
    expect(MAX_CLINIC_PRACTITIONERS).toBe(5)
    expect(clinicSeatsLeft('cabinet', 1)).toBe(4)
    expect(clinicSeatsLeft('cabinet', 5)).toBe(0)
  })

  it("ne descend jamais sous zéro, même si un cabinet existant dépasse déjà la limite", () => {
    expect(clinicSeatsLeft('cabinet', 7)).toBe(0)
  })

  it("limite un cabinet non activé à son seul créateur", () => {
    expect(clinicSeatsLeft('free', 0)).toBe(1)
    expect(clinicSeatsLeft('free', 1)).toBe(0)
    expect(clinicSeatsLeft(undefined, 1)).toBe(0)
  })
})

describe('libellés', () => {
  it("nomme les offres", () => {
    expect(PLAN_LABEL.free).toBe('Offre gratuite')
    expect(PLAN_LABEL.pro).toBe('Abonnement')
    expect(CLINIC_PLAN_LABEL.free).toBe('Cabinet non activé')
    expect(CLINIC_PLAN_LABEL.cabinet).toBe('Abonnement cabinet')
  })
})
