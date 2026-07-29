// src/lib/nextSlot.ts
// Calcule le prochain créneau réservable d'un praticien, jour après jour,
// en réutilisant generateAvailableSlots (slots.ts) — même logique que la
// génération de créneaux d'une journée, appliquée sur une fenêtre glissante
// jusqu'à trouver le premier créneau libre, ou épuiser la fenêtre.

import { isToday, isTomorrow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { generateAvailableSlots, type SlotAvailabilityRule, type BlockedRange } from './slots'

export interface NextSlotAvailabilityRule extends SlotAvailabilityRule {
  day_of_week: number
}

export function findNextAvailableSlot(
  availabilities: NextSlotAvailabilityRule[],
  bookedTimes: Set<number>,
  blockedRanges: BlockedRange[],
  minStart: number,
  fromDate: Date,
  windowDays: number = 30
): Date | null {
  if (availabilities.length === 0) return null

  for (let i = 0; i < windowDays; i++) {
    const day = new Date(fromDate)
    day.setDate(day.getDate() + i)
    const dayOfWeek = day.getDay()
    const dayAvailabilities = availabilities.filter(a => a.day_of_week === dayOfWeek)
    if (dayAvailabilities.length === 0) continue

    const slots = generateAvailableSlots(day, dayAvailabilities, bookedTimes, blockedRanges, minStart)
    if (slots.length > 0) {
      return slots.reduce((earliest, s) => (s < earliest ? s : earliest))
    }
  }
  return null
}

export function formatNextSlotLabel(date: Date): string {
  const time = format(date, 'HH:mm')
  if (isToday(date)) return `Aujourd'hui à ${time}`
  if (isTomorrow(date)) return `Demain à ${time}`
  return `${format(date, 'd MMM', { locale: fr })} à ${time}`
}
