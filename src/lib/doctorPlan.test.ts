import { describe, it, expect } from 'vitest'
import {
  hasProFeatures, otherPlan, otherClinicPlan, clinicSeatsLeft, PLAN_LABEL, CLINIC_PLAN_LABEL,
  MAX_CLINIC_PRACTITIONERS, doctorFlagLabels, clinicStatusText, upgradeMailto, UPGRADE_CONTACT_EMAIL,
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

describe('doctorFlagLabels', () => {
  it("signale une offre gratuite et une fiche masquée, et rien pour un abonné visible", () => {
    expect(doctorFlagLabels({ plan: 'free', is_listed: false })).toEqual(['Offre gratuite', 'Masqué'])
    expect(doctorFlagLabels({ plan: 'free', is_listed: true })).toEqual(['Offre gratuite'])
    expect(doctorFlagLabels({ plan: 'pro', is_listed: false })).toEqual(['Masqué'])
    expect(doctorFlagLabels({ plan: 'pro', is_listed: true })).toEqual([])
  })

  it("ne signale rien sur une valeur absente (cache d'avant les migrations)", () => {
    expect(doctorFlagLabels({})).toEqual([])
    expect(doctorFlagLabels({ plan: null, is_listed: null })).toEqual([])
    expect(doctorFlagLabels(undefined)).toEqual([])
  })
})

describe('clinicStatusText', () => {
  it("explique ce qu'interdit un cabinet non activé", () => {
    const s = clinicStatusText('free', 1)
    expect(s.active).toBe(false)
    expect(s.text).toMatch(/pas encore activé/)
    expect(s.text).toMatch(/5 praticiens/)
    expect(s.text).toMatch(/secrétariat/)
  })

  it("compte les praticiens d'un cabinet abonné et signale quand il est complet", () => {
    expect(clinicStatusText('cabinet', 1)).toEqual({ active: true, text: '1 praticien sur 5.' })
    expect(clinicStatusText('cabinet', 3).text).toBe('3 praticiens sur 5.')
    expect(clinicStatusText('cabinet', 5).text).toBe('5 praticiens sur 5 : le cabinet est complet.')
  })

  it("traite un cabinet sans offre connue comme abonné (cache d'avant la migration)", () => {
    expect(clinicStatusText(undefined, 2).active).toBe(true)
    expect(clinicStatusText(null, 2).active).toBe(true)
  })
})

describe('upgradeMailto', () => {
  it("pointe vers l'adresse de l'équipe avec un objet et un message encodés", () => {
    const url = upgradeMailto('Gary Test')
    expect(url.startsWith(`mailto:${UPGRADE_CONTACT_EMAIL}?`)).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('subject')).toBe("Demande d'abonnement Animéaux")
    expect(params.get('body')).toContain("passer à l'abonnement Animéaux (Gary Test)")
  })

  it("reste valide sans nom ou avec un nom vide", () => {
    for (const name of [undefined, null, '', '   ']) {
      const params = new URLSearchParams(upgradeMailto(name as any).split('?')[1])
      expect(params.get('body')).toContain("passer à l'abonnement Animéaux.")
      expect(params.get('body')).not.toContain('()')
    }
  })
})
