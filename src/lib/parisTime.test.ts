import { describe, it, expect } from 'vitest'
import { parisDateKey, parisDayOfWeek, parisTimeToUtc, parisTimeString, PARIS_TZ, addDaysToDateKey, parisStartOfWeekKey, parisMinutesOfDay, parisCalendarDaysDiff } from './parisTime'

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

describe('parisMinutesOfDay', () => {
  it('convertit un instant en minutes depuis minuit, heure de Paris', () => {
    expect(parisMinutesOfDay(parisTimeToUtc('2026-09-21', '11:30:00'))).toBe(11 * 60 + 30)
    expect(parisMinutesOfDay(parisTimeToUtc('2026-09-21', '00:00:00'))).toBe(0)
    expect(parisMinutesOfDay(parisTimeToUtc('2026-09-21', '23:45:00'))).toBe(23 * 60 + 45)
  })
})

describe('parisCalendarDaysDiff', () => {
  it('vaut 0 pour le même jour calendaire à Paris, même à des heures différentes', () => {
    const morning = parisTimeToUtc('2026-09-21', '08:00:00')
    const evening = parisTimeToUtc('2026-09-21', '22:00:00')
    expect(parisCalendarDaysDiff(evening, morning)).toBe(0)
  })

  it('compte les jours à venir positivement', () => {
    const from = parisTimeToUtc('2026-09-21', '12:00:00')
    const target = parisTimeToUtc('2026-09-24', '09:00:00')
    expect(parisCalendarDaysDiff(target, from)).toBe(3)
  })

  it('compte les jours passés négativement', () => {
    const from = parisTimeToUtc('2026-09-21', '12:00:00')
    const target = parisTimeToUtc('2026-09-18', '09:00:00')
    expect(parisCalendarDaysDiff(target, from)).toBe(-3)
  })
})

describe('addDaysToDateKey', () => {
  it('avance de N jours', () => {
    expect(addDaysToDateKey('2026-09-21', 5)).toBe('2026-09-26')
  })

  it('recule de N jours (nombre négatif)', () => {
    expect(addDaysToDateKey('2026-09-21', -3)).toBe('2026-09-18')
  })

  it('traverse correctement un changement de mois', () => {
    expect(addDaysToDateKey('2026-09-28', 5)).toBe('2026-10-03')
  })

  it('à 0 jours, renvoie la même clé', () => {
    expect(addDaysToDateKey('2026-09-21', 0)).toBe('2026-09-21')
  })
})

describe('parisStartOfWeekKey', () => {
  it('renvoie la même clé pour un lundi', () => {
    expect(parisStartOfWeekKey('2026-09-21')).toBe('2026-09-21') // lundi
  })

  it('remonte au lundi précédent pour un jour en milieu de semaine', () => {
    expect(parisStartOfWeekKey('2026-09-24')).toBe('2026-09-21') // jeudi -> lundi
  })

  it('remonte au lundi précédent (pas au lundi suivant) pour un dimanche', () => {
    expect(parisStartOfWeekKey('2026-09-27')).toBe('2026-09-21') // dimanche -> lundi de la même semaine
  })

  it('traverse correctement un changement de mois', () => {
    expect(parisStartOfWeekKey('2026-10-01')).toBe('2026-09-28') // jeudi 1er oct. -> lundi 28 sept.
  })
})
