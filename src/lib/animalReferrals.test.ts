import { describe, it, expect } from 'vitest'
import { referralStatusLabel } from './animalReferrals'

describe('referralStatusLabel', () => {
  it('donne un libellé distinct pour chacun des 4 statuts', () => {
    expect(referralStatusLabel('pending')).toBe('En attente de votre accord')
    expect(referralStatusLabel('accepted')).toBe('Accepté')
    expect(referralStatusLabel('declined')).toBe('Refusé')
    expect(referralStatusLabel('revoked')).toBe('Accès révoqué')
  })

  it('ne confond jamais "refusé" et "révoqué" (deux statuts terminaux distincts)', () => {
    expect(referralStatusLabel('declined')).not.toBe(referralStatusLabel('revoked'))
  })
})
