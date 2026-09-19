import { describe, it, expect } from 'vitest'
import { generateAvailableSlots, type SlotAvailabilityRule } from './slots'
import { parisTimeToUtc, parisTimeString } from './parisTime'

// Date fixe et lointaine dans le futur pour ne jamais être affectée par le
// délai de battement de 15 min (minStart) selon quand les tests tournent.
// Construite via parisTimeToUtc (pas `new Date('2030-06-10T00:00:00')`,
// interprétée dans le fuseau LOCAL du runner) pour représenter sans
// ambiguïté minuit à Paris ce jour-là, quel que soit le fuseau système —
// cet environnement tourne en Asia/Kuala_Lumpur (UTC+8), qui aurait
// silencieusement décalé le jour calendaire à Paris d'un jour.
const FAR_FUTURE_DAY = parisTimeToUtc('2030-06-10', '00:00:00')
const PAST_MIN_START = 0 // aucun créneau exclu par le battement dans ces tests

describe('generateAvailableSlots', () => {
  it('génère un créneau par pas de slot_duration_minutes entre start_time et end_time', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set(), [], PAST_MIN_START)
    expect(slots).toHaveLength(2)
    expect(parisTimeString(slots[0])).toBe('09:00')
    expect(parisTimeString(slots[1])).toBe('09:30')
  })

  it('exclut un créneau déjà réservé (bookedTimes)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const nineAM = parisTimeToUtc('2030-06-10', '09:00')
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set([nineAM.getTime()]), [], PAST_MIN_START)
    expect(slots).toHaveLength(1)
    expect(parisTimeString(slots[0])).toBe('09:30')
  })

  it('exclut un créneau qui tombe dans une période de congé (blockedRanges)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const rangeStart = parisTimeToUtc('2030-06-10', '08:00')
    const rangeEnd = parisTimeToUtc('2030-06-10', '09:15')
    const slots = generateAvailableSlots(
      FAR_FUTURE_DAY, rules, new Set(),
      [{ start: rangeStart.getTime(), end: rangeEnd.getTime() }],
      PAST_MIN_START
    )
    // Le créneau de 9h est dans [8h, 9h15[, celui de 9h30 non.
    expect(slots).toHaveLength(1)
    expect(parisTimeString(slots[0])).toBe('09:30')
  })

  it('exclut les créneaux avant le délai de battement minimum (minStart)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const nineThirtyAM = parisTimeToUtc('2030-06-10', '09:30')
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set(), [], nineThirtyAM.getTime())
    expect(slots).toHaveLength(1)
    expect(parisTimeString(slots[0])).toBe('09:30')
  })

  it('combine plusieurs plages de disponibilité le même jour', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '09:30', slot_duration_minutes: 30 },
      { start_time: '14:00', end_time: '15:00', slot_duration_minutes: 30 },
    ]
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set(), [], PAST_MIN_START)
    expect(slots).toHaveLength(3) // 1 le matin + 2 l'après-midi
  })

  it('ne génère aucun créneau sans disponibilité', () => {
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, [], new Set(), [], PAST_MIN_START)
    expect(slots).toEqual([])
  })

  it('respecte une durée de créneau non standard (ex: 45 min)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:30', slot_duration_minutes: 45 },
    ]
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set(), [], PAST_MIN_START)
    // 09:00, 09:45 — 10:30 est exclu (cur < end strict)
    expect(slots).toHaveLength(2)
    expect(parisTimeString(slots[1])).toBe('09:45')
  })

  it('génère des créneaux corrects quel que soit le fuseau horaire du jour donné en entrée', () => {
    // Le paramètre `date` ne sert qu'à identifier le jour calendaire à
    // Paris (parisDateKey) — un instant qui tombe sur le même jour à Paris
    // mais à une autre heure doit produire exactement les mêmes créneaux.
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const sameDayDifferentHour = parisTimeToUtc('2030-06-10', '18:45')
    const slots = generateAvailableSlots(sameDayDifferentHour, rules, new Set(), [], PAST_MIN_START)
    expect(slots).toHaveLength(2)
    expect(parisTimeString(slots[0])).toBe('09:00')
  })
})
