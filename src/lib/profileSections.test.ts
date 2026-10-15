import { describe, it, expect } from 'vitest'
import {
  PROFILE_SECTIONS, parseProfileSection, PATIENT_PROFILE_SECTIONS, parsePatientProfileSection, roleLabel,
} from './profileSections'

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

describe('profil patient', () => {
  it('a trois sous-onglets : profil, notifications, données et compte', () => {
    expect(PATIENT_PROFILE_SECTIONS.map(s => s.id)).toEqual(['profil', 'notifications', 'donnees'])
  })
  it('lit la section demandée, et ouvre « Mon profil » pour le reste (même une section du praticien)', () => {
    expect(parsePatientProfileSection('notifications')).toBe('notifications')
    expect(parsePatientProfileSection('donnees')).toBe('donnees')
    for (const v of [null, undefined, '', 'abonnement', 'inconnu']) expect(parsePatientProfileSection(v)).toBe('profil')
  })
})

describe('roleLabel', () => {
  it('nomme le rôle, l\'administrateur passant avant', () => {
    expect(roleLabel('patient')).toBe('Propriétaire')
    expect(roleLabel('doctor')).toBe('Praticien')
    expect(roleLabel('secretary')).toBe('Secrétariat')
    expect(roleLabel('patient', true)).toBe('Administrateur')
  })
  it("renvoie une chaîne vide pour un rôle inconnu ou absent", () => {
    expect(roleLabel(undefined)).toBe('')
    expect(roleLabel('autre')).toBe('')
  })
})
