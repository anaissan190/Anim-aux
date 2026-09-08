import { describe, it, expect } from 'vitest'
import { matchesSpecialtySearch } from './doctorSearch'

describe('matchesSpecialtySearch', () => {
  it('matche quand le terme est un sous-texte de la spécialité stockée', () => {
    expect(matchesSpecialtySearch('Comportementaliste animalier', 'comportementaliste')).toBe(true)
  })

  it('matche quand la spécialité stockée est un sous-texte plus court du terme recherché (libellé renommé depuis, non mis à jour sur la fiche)', () => {
    expect(matchesSpecialtySearch('Comportementaliste', 'comportementaliste animalier')).toBe(true)
  })

  it('est insensible à la casse', () => {
    expect(matchesSpecialtySearch('VÉTÉRINAIRE', 'vétérinaire')).toBe(true)
  })

  it('ne matche pas un métier sans rapport', () => {
    expect(matchesSpecialtySearch('Toiletteur', 'vétérinaire')).toBe(false)
  })

  it('ne matche jamais une spécialité vide ou absente, quel que soit le terme', () => {
    expect(matchesSpecialtySearch('', 'chat')).toBe(false)
    expect(matchesSpecialtySearch(null, 'chat')).toBe(false)
    expect(matchesSpecialtySearch(undefined, 'chat')).toBe(false)
  })
})
