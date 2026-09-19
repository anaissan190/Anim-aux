import { describe, it, expect } from 'vitest'
import { parisDateKey, parisDayOfWeek, parisTimeToUtc, parisTimeString, PARIS_TZ } from './parisTime'

describe('parisDateKey', () => {
  it('donne la date à Paris, pas celle du fuseau local d\'exécution', () => {
    // 21 sept. 2026 23:30 UTC = 22 sept. 01:30 à Paris (UTC+2, heure d'été)
    expect(parisDateKey(new Date('2026-09-21T23:30:00Z'))).toBe('2026-09-22')
    // 21 sept. 2026 21:30 UTC = 21 sept. 23:30 à Paris — encore le même jour
    expect(parisDateKey(new Date('2026-09-21T21:30:00Z'))).toBe('2026-09-21')
  })

  it('gère l\'heure d\'hiver (UTC+1)', () => {
    // 21 janvier 2026 22:30 UTC = 21 janvier 23:30 à Paris (UTC+1)
    expect(parisDateKey(new Date('2026-01-21T22:30:00Z'))).toBe('2026-01-21')
    // 21 janvier 2026 23:30 UTC = 22 janvier 00:30 à Paris
    expect(parisDateKey(new Date('2026-01-21T23:30:00Z'))).toBe('2026-01-22')
  })
})

describe('parisDayOfWeek', () => {
  it('renvoie le bon jour de semaine (0=dimanche...6=samedi)', () => {
    expect(parisDayOfWeek('2026-09-21')).toBe(1) // lundi
    expect(parisDayOfWeek('2026-09-20')).toBe(0) // dimanche
    expect(parisDayOfWeek('2026-09-26')).toBe(6) // samedi
  })
})

describe('parisTimeToUtc', () => {
  it('convertit une heure murale de Paris en instant UTC correct (heure d\'été)', () => {
    // 21 sept. 2026 11:30 à Paris (UTC+2) = 09:30 UTC
    const result = parisTimeToUtc('2026-09-21', '11:30:00')
    expect(result.toISOString()).toBe('2026-09-21T09:30:00.000Z')
  })

  it('convertit une heure murale de Paris en instant UTC correct (heure d\'hiver)', () => {
    // 21 janvier 2026 11:30 à Paris (UTC+1) = 10:30 UTC
    const result = parisTimeToUtc('2026-01-21', '11:30:00')
    expect(result.toISOString()).toBe('2026-01-21T10:30:00.000Z')
  })

  it('reproduit le bug corrigé : un "11:30" choisi depuis un fuseau à 6h d\'écart ne doit plus être confondu avec 11:30 Paris', () => {
    // Ancien calcul buggé : construire "11:30" en heure LOCALE d'un
    // appareil basé en Malaisie (UTC+8) puis sérialiser en UTC donnait
    // 03:30 UTC, que le serveur (ancré sur Europe/Paris) interprétait
    // comme 05:30 à Paris — hors des horaires 09:00-18:00 du praticien.
    const malaysiaLocalAsUtc = new Date('2026-09-21T03:30:00Z') // "11:30" heure Malaisie (UTC+8)
    const trueParisSlot = parisTimeToUtc('2026-09-21', '11:30:00') // vrai 11:30 Paris
    expect(malaysiaLocalAsUtc.getTime()).not.toBe(trueParisSlot.getTime())
    expect(parisTimeString(trueParisSlot)).toBe('11:30')
  })
})

describe('parisTimeString', () => {
  it('affiche l\'heure murale à Paris quel que soit l\'instant UTC donné', () => {
    expect(parisTimeString(new Date('2026-09-21T09:30:00.000Z'))).toBe('11:30')
    expect(parisTimeString(new Date('2026-01-21T10:30:00.000Z'))).toBe('11:30')
  })
})

describe('PARIS_TZ', () => {
  it('est bien "Europe/Paris"', () => {
    expect(PARIS_TZ).toBe('Europe/Paris')
  })
})
