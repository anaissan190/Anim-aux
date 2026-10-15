import { describe, it, expect } from 'vitest'
import { PROFILE_SECTIONS, parseProfileSection } from './profileSections'

describe('parseProfileSection', () => {
  it('reconnaît chaque sous-onglet', () => {
    for (const s of PROFILE_SECTIONS) expect(parseProfileSection(s.id)).toBe(s.id)
  })
  it('ouvre « Mon profil » pour une valeur absente ou inconnue', () => {
    for (const v of [null, undefined, '', 'inconnu', 'ABONNEMENT', 'visibilite']) expect(parseProfileSection(v)).toBe('profil')
  })
  it('garde « Mon profil » en premier et quatre sous-onglets', () => {
    expect(PROFILE_SECTIONS.map(s => s.id)).toEqual(['profil', 'abonnement', 'notifications', 'donnees'])
  })
})
