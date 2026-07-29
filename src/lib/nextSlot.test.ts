import { describe, it, expect } from 'vitest'
import { findNextAvailableSlot, formatNextSlotLabel } from './nextSlot'

// Lundi 2026-08-03, mardi 2026-08-04, etc. — dates de référence fixes pour
// des tests déterministes indépendants du jour d'exécution.
const MONDAY = new Date('2026-08-03T00:00:00')
const TUESDAY_DOW = 2

describe('findNextAvailableSlot', () => {
  it("renvoie null si le praticien n'a aucune disponibilité", () => {
    const result = findNextAvailableSlot([], new Set(), [], 0, MONDAY)
    expect(result).toBeNull()
  })

  it('trouve le premier créneau du jour même si le praticien est disponible aujourd\'hui', () => {
    const availabilities = [{ day_of_week: MONDAY.getDay(), start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 }]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY)
    expect(result).not.toBeNull()
    expect(result!.getHours()).toBe(9)
    expect(result!.getMinutes()).toBe(0)
  })

  it("passe à l'occurrence suivante du jour de la semaine si le seul créneau est déjà réservé", () => {
    const availabilities = [{ day_of_week: MONDAY.getDay(), start_time: '09:00', end_time: '09:30', slot_duration_minutes: 30 }]
    const bookedTime = new Date(MONDAY); bookedTime.setHours(9, 0, 0, 0)
    const result = findNextAvailableSlot(availabilities, new Set([bookedTime.getTime()]), [], 0, MONDAY)
    // Le praticien ne travaille que le lundi : le prochain créneau libre est le lundi suivant.
    expect(result).not.toBeNull()
    expect(result!.getDay()).toBe(MONDAY.getDay())
    expect(result!.getDate()).toBe(10)
  })

  it('trouve le prochain jour de la semaine où le praticien travaille', () => {
    const availabilities = [{ day_of_week: TUESDAY_DOW, start_time: '14:00', end_time: '15:00', slot_duration_minutes: 30 }]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY)
    expect(result).not.toBeNull()
    expect(result!.getDay()).toBe(TUESDAY_DOW)
    expect(result!.getHours()).toBe(14)
  })

  it('ignore les créneaux avant minStart (ex: déjà passés dans la journée)', () => {
    const availabilities = [{ day_of_week: MONDAY.getDay(), start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 }]
    const minStart = new Date(MONDAY); minStart.setHours(9, 30, 0, 0)
    const result = findNextAvailableSlot(availabilities, new Set(), [], minStart.getTime(), MONDAY)
    expect(result!.getHours()).toBe(9)
    expect(result!.getMinutes()).toBe(30)
  })

  it('respecte les congés (blocked ranges) et passe au jour suivant disponible', () => {
    const availabilities = [{ day_of_week: MONDAY.getDay(), start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 }]
    const blockStart = new Date(MONDAY); blockStart.setHours(0, 0, 0, 0)
    const blockEnd = new Date(MONDAY); blockEnd.setHours(23, 59, 59, 999)
    const result = findNextAvailableSlot(
      availabilities, new Set(), [{ start: blockStart.getTime(), end: blockEnd.getTime() }], 0, MONDAY
    )
    // Ce lundi précis est bloqué (congé) : le prochain créneau est le lundi suivant.
    expect(result).not.toBeNull()
    expect(result!.getDate()).toBe(10)
  })

  it('renvoie null si les congés couvrent toute la fenêtre de recherche', () => {
    const availabilities = [{ day_of_week: MONDAY.getDay(), start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 }]
    const blockStart = new Date(MONDAY); blockStart.setHours(0, 0, 0, 0)
    const blockEnd = new Date(MONDAY); blockEnd.setDate(blockEnd.getDate() + 30)
    const result = findNextAvailableSlot(
      availabilities, new Set(), [{ start: blockStart.getTime(), end: blockEnd.getTime() }], 0, MONDAY, 30
    )
    expect(result).toBeNull()
  })

  it('renvoie null si aucun créneau libre dans la fenêtre de recherche', () => {
    const availabilities = [{ day_of_week: TUESDAY_DOW, start_time: '14:00', end_time: '15:00', slot_duration_minutes: 30 }]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY, 1) // fenêtre d'un seul jour (lundi)
    expect(result).toBeNull()
  })

  it('prend le créneau le plus tôt quand plusieurs plages se chevauchent le même jour', () => {
    const availabilities = [
      { day_of_week: MONDAY.getDay(), start_time: '14:00', end_time: '15:00', slot_duration_minutes: 30 },
      { day_of_week: MONDAY.getDay(), start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY)
    expect(result!.getHours()).toBe(9)
  })
})

describe('formatNextSlotLabel', () => {
  it('affiche "Aujourd\'hui à HH:mm" pour un créneau du jour même', () => {
    const today = new Date()
    today.setHours(14, 30, 0, 0)
    expect(formatNextSlotLabel(today)).toBe("Aujourd'hui à 14:30")
  })

  it('affiche "Demain à HH:mm" pour un créneau le lendemain', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    expect(formatNextSlotLabel(tomorrow)).toBe('Demain à 09:00')
  })

  it('affiche "d MMM à HH:mm" au-delà de demain', () => {
    const later = new Date()
    later.setDate(later.getDate() + 10)
    later.setHours(11, 15, 0, 0)
    expect(formatNextSlotLabel(later)).not.toContain("Aujourd'hui")
    expect(formatNextSlotLabel(later)).not.toContain('Demain')
    expect(formatNextSlotLabel(later)).toContain('11:15')
  })
})
