// src/lib/nextSlot.ts
// Calcule le prochain créneau réservable d'un praticien, jour après jour,
// en réutilisant generateAvailableSlots (slots.ts) — même logique que la
// génération de créneaux d'une journée, appliquée sur une fenêtre glissante
// jusqu'à trouver le premier créneau libre, ou épuiser la fenêtre.

import { fr } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { generateAvailableSlots, type SlotAvailabilityRule, type BlockedRange } from './slots'
import { parisDateKey, parisDayOfWeek, parisTimeString, PARIS_TZ } from './parisTime'

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
    // Ancré sur le jour calendaire à Paris (voir src/lib/parisTime.ts), pas
    // sur le fuseau local de l'appareil — sinon le badge "prochaine
    // disponibilité" et le tri des résultats de recherche sont faux pour
    // un visiteur connecté depuis un autre fuseau.
    const dayOfWeek = parisDayOfWeek(parisDateKey(day))
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
  const time = parisTimeString(date)
  const dateKey = parisDateKey(date)
  const todayKey = parisDateKey(new Date())
  if (dateKey === todayKey) return `Aujourd'hui à ${time}`
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateKey === parisDateKey(tomorrow)) return `Demain à ${time}`
  return `${formatInTimeZone(date, PARIS_TZ, 'd MMM', { locale: fr })} à ${time}`
}
