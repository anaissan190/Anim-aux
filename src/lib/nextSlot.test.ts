import { describe, it, expect } from 'vitest'
import { findNextAvailableSlot, formatNextSlotLabel } from './nextSlot'
import { parisTimeToUtc, parisDayOfWeek, parisTimeString, parisDateKey } from './parisTime'

// Lundi 2026-08-03, mardi 2026-08-04 — dates de référence fixes pour des
// tests déterministes indépendants du jour d'exécution. Construites via
// parisTimeToUtc (pas `new Date('2026-08-03T00:00:00')`, interprétée dans
// le fuseau LOCAL du runner) pour représenter sans ambiguïté minuit à Paris
// ce jour-là — cet environnement tourne en Asia/Kuala_Lumpur (UTC+8), qui
// aurait silencieusement décalé le jour calendaire à Paris.
const MONDAY = parisTimeToUtc('2026-08-03', '00:00:00')
const MONDAY_DOW = parisDayOfWeek('2026-08-03') // 1
const TUESDAY_DOW = parisDayOfWeek('2026-08-04') // 2

describe('findNextAvailableSlot', () => {
  it("renvoie null si le praticien n'a aucune disponibilité", () => {
    const result = findNextAvailableSlot([], new Set(), [], 0, MONDAY)
    expect(result).toBeNull()
  })

  it('trouve le premier créneau du jour même si le praticien est disponible aujourd\'hui', () => {
    const availabilities = [{ day_of_week: MONDAY_DOW, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 }]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY)
    expect(result).not.toBeNull()
    expect(parisTimeString(result!)).toBe('09:00')
  })

  it("passe à l'occurrence suivante du jour de la semaine si le seul créneau est déjà réservé", () => {
    const availabilities = [{ day_of_week: MONDAY_DOW, start_time: '09:00', end_time: '09:30', slot_duration_minutes: 30 }]
    const bookedTime = parisTimeToUtc('2026-08-03', '09:00')
    const result = findNextAvailableSlot(availabilities, new Set([bookedTime.getTime()]), [], 0, MONDAY)
    // Le praticien ne travaille que le lundi : le prochain créneau libre est le lundi suivant.
    expect(result).not.toBeNull()
    expect(parisDateKey(result!)).toBe('2026-08-10')
  })

  it('trouve le prochain jour de la semaine où le praticien travaille', () => {
    const availabilities = [{ day_of_week: TUESDAY_DOW, start_time: '14:00', end_time: '15:00', slot_duration_minutes: 30 }]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY)
    expect(result).not.toBeNull()
    expect(parisDateKey(result!)).toBe('2026-08-04')
    expect(parisTimeString(result!)).toBe('14:00')
  })

  it('ignore les créneaux avant minStart (ex: déjà passés dans la journée)', () => {
    const availabilities = [{ day_of_week: MONDAY_DOW, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 }]
    const minStart = parisTimeToUtc('2026-08-03', '09:30')
    const result = findNextAvailableSlot(availabilities, new Set(), [], minStart.getTime(), MONDAY)
    expect(parisTimeString(result!)).toBe('09:30')
  })

  it('respecte les congés (blocked ranges) et passe au jour suivant disponible', () => {
    const availabilities = [{ day_of_week: MONDAY_DOW, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 }]
    const blockStart = parisTimeToUtc('2026-08-03', '00:00:00')
    const blockEnd = parisTimeToUtc('2026-08-03', '23:59:59.999')
    const result = findNextAvailableSlot(
      availabilities, new Set(), [{ start: blockStart.getTime(), end: blockEnd.getTime() }], 0, MONDAY
    )
    // Ce lundi précis est bloqué (congé) : le prochain créneau est le lundi suivant.
    expect(result).not.toBeNull()
    expect(parisDateKey(result!)).toBe('2026-08-10')
  })

  it('renvoie null si les congés couvrent toute la fenêtre de recherche', () => {
    const availabilities = [{ day_of_week: MONDAY_DOW, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 }]
    const blockStart = parisTimeToUtc('2026-08-03', '00:00:00')
    const blockEnd = parisTimeToUtc('2026-09-02', '00:00:00')
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
      { day_of_week: MONDAY_DOW, start_time: '14:00', end_time: '15:00', slot_duration_minutes: 30 },
      { day_of_week: MONDAY_DOW, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const result = findNextAvailableSlot(availabilities, new Set(), [], 0, MONDAY)
    expect(parisTimeString(result!)).toBe('09:00')
  })
})

describe('formatNextSlotLabel', () => {
  it('affiche "Aujourd\'hui à HH:mm" pour un créneau du jour même', () => {
    const today = parisTimeToUtc(parisDateKey(), '14:30')
    expect(formatNextSlotLabel(today)).toBe("Aujourd'hui à 14:30")
  })

  it('affiche "Demain à HH:mm" pour un créneau le lendemain', () => {
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = parisTimeToUtc(parisDateKey(tomorrowDate), '09:00')
    expect(formatNextSlotLabel(tomorrow)).toBe('Demain à 09:00')
  })

  it('affiche "d MMM à HH:mm" au-delà de demain', () => {
    const laterDate = new Date(); laterDate.setDate(laterDate.getDate() + 10)
    const later = parisTimeToUtc(parisDateKey(laterDate), '11:15')
    expect(formatNextSlotLabel(later)).not.toContain("Aujourd'hui")
    expect(formatNextSlotLabel(later)).not.toContain('Demain')
    expect(formatNextSlotLabel(later)).toContain('11:15')
  })
})
