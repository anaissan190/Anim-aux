import { describe, it, expect } from 'vitest'
import { referralStatusLabel, referralSenderStatusLabel, referralBadgeClass } from './animalReferrals'
import type { AnimalReferralStatus } from '@/types'

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

describe('referralSenderStatusLabel', () => {
  it('parle du point de vue du praticien qui envoie (il attend l\u2019accord du propriétaire)', () => {
    expect(referralSenderStatusLabel('pending')).toBe('En attente de l\u2019accord du propriétaire')
    expect(referralSenderStatusLabel('accepted')).toBe('Accepté par le propriétaire')
    expect(referralSenderStatusLabel('declined')).toBe('Refusé par le propriétaire')
    expect(referralSenderStatusLabel('revoked')).toBe('Accès révoqué')
  })

  it('ne confond jamais "refusé" et "révoqué"', () => {
    expect(referralSenderStatusLabel('declined')).not.toBe(referralSenderStatusLabel('revoked'))
  })
})

describe('referralBadgeClass', () => {
  const statuses: AnimalReferralStatus[] = ['pending', 'accepted', 'declined', 'revoked']

  it('donne une pastille distincte à chaque statut', () => {
    const classes = statuses.map(referralBadgeClass)
    expect(new Set(classes).size).toBe(4)
  })

  it('utilise des classes de pastille qui existent dans index.css', () => {
    for (const s of statuses) expect(referralBadgeClass(s)).toMatch(/^badge-(yellow|green|red|gray)$/)
  })
})
