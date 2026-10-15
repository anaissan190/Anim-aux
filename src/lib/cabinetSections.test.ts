import { describe, it, expect } from 'vitest'
import { cabinetSections, parseCabinetSection } from './cabinetSections'

describe('cabinetSections', () => {
  it('le créateur a cinq sous-onglets, dans cet ordre', () => {
    expect(cabinetSections(true).map(s => s.id)).toEqual(['apercu', 'equipe', 'stats', 'secretariat', 'reglages'])
  })
  it("un simple membre n'a ni secrétariat ni réglages", () => {
    expect(cabinetSections(false).map(s => s.id)).toEqual(['apercu', 'equipe', 'stats'])
  })
})

describe('parseCabinetSection', () => {
  it('ouvre la section demandée quand elle est permise', () => {
    expect(parseCabinetSection('equipe', true)).toBe('equipe')
    expect(parseCabinetSection('reglages', true)).toBe('reglages')
    expect(parseCabinetSection('stats', false)).toBe('stats')
  })
  it("refuse à un membre les sections réservées au créateur, même par l'adresse", () => {
    expect(parseCabinetSection('secretariat', false)).toBe('apercu')
    expect(parseCabinetSection('reglages', false)).toBe('apercu')
  })
  it("ouvre la vue d'ensemble pour une valeur absente, inconnue ou venue du profil", () => {
    for (const v of [null, undefined, '', 'inconnu', 'profil', 'abonnement']) {
      expect(parseCabinetSection(v, true)).toBe('apercu')
    }
  })
})
