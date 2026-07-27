import { describe, it, expect } from 'vitest'
import { generateAvailableSlots, type SlotAvailabilityRule } from './slots'

// Date fixe et lointaine dans le futur pour ne jamais être affectée par le
// délai de battement de 15 min (minStart) selon quand les tests tournent.
const FAR_FUTURE_DAY = new Date('2030-06-10T00:00:00')
const PAST_MIN_START = 0 // aucun créneau exclu par le battement dans ces tests

describe('generateAvailableSlots', () => {
  it('génère un créneau par pas de slot_duration_minutes entre start_time et end_time', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set(), [], PAST_MIN_START)
    expect(slots).toHaveLength(2)
    expect(slots[0].getHours()).toBe(9)
    expect(slots[0].getMinutes()).toBe(0)
    expect(slots[1].getHours()).toBe(9)
    expect(slots[1].getMinutes()).toBe(30)
  })

  it('exclut un créneau déjà réservé (bookedTimes)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const nineAM = new Date(FAR_FUTURE_DAY)
    nineAM.setHours(9, 0, 0, 0)
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set([nineAM.getTime()]), [], PAST_MIN_START)
    expect(slots).toHaveLength(1)
    expect(slots[0].getMinutes()).toBe(30)
  })

  it('exclut un créneau qui tombe dans une période de congé (blockedRanges)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const rangeStart = new Date(FAR_FUTURE_DAY); rangeStart.setHours(8, 0, 0, 0)
    const rangeEnd = new Date(FAR_FUTURE_DAY); rangeEnd.setHours(9, 15, 0, 0)
    const slots = generateAvailableSlots(
      FAR_FUTURE_DAY, rules, new Set(),
      [{ start: rangeStart.getTime(), end: rangeEnd.getTime() }],
      PAST_MIN_START
    )
    // Le créneau de 9h est dans [8h, 9h15[, celui de 9h30 non.
    expect(slots).toHaveLength(1)
    expect(slots[0].getMinutes()).toBe(30)
  })

  it('exclut les créneaux avant le délai de battement minimum (minStart)', () => {
    const rules: SlotAvailabilityRule[] = [
      { start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const nineThirtyAM = new Date(FAR_FUTURE_DAY)
    nineThirtyAM.setHours(9, 30, 0, 0)
    const slots = generateAvailableSlots(FAR_FUTURE_DAY, rules, new Set(), [], nineThirtyAM.getTime())
    expect(slots).toHaveLength(1)
    expect(slots[0].getMinutes()).toBe(30)
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
    expect(slots[1].getHours()).toBe(9)
    expect(slots[1].getMinutes()).toBe(45)
  })
})
