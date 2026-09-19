// src/lib/slots.ts
// Génération des créneaux réservables d'une journée — extrait de
// useAvailableSlots (useData.ts) en fonction pure pour être testable sans
// mocker Supabase. Ne s'occupe que du calcul une fois les données déjà
// chargées (disponibilités, créneaux déjà réservés, congés) ; ne fait
// aucun accès réseau.

import { addMinutes } from 'date-fns'
import { parisDateKey, parisTimeToUtc } from './parisTime'

export interface SlotAvailabilityRule {
  start_time: string
  end_time: string
  slot_duration_minutes: number
}

export interface BlockedRange {
  start: number
  end: number
}

export function generateAvailableSlots(
  date: Date,
  availabilities: SlotAvailabilityRule[],
  bookedTimes: Set<number>,
  blockedRanges: BlockedRange[],
  minStart: number
): Date[] {
  const slots: Date[] = []
  // Ancré sur le jour calendaire à Paris (voir parisTime.ts), pas sur le
  // fuseau local de l'appareil qui exécute ce code — sinon un visiteur
  // connecté depuis un autre fuseau voit des créneaux qui ne correspondent
  // pas à l'heure réelle du praticien, rejetés ensuite par le serveur.
  const dateKey = parisDateKey(date)
  for (const a of availabilities) {
    let cur = parisTimeToUtc(dateKey, a.start_time)
    const end = parisTimeToUtc(dateKey, a.end_time)
    while (cur < end) {
      const t = cur.getTime()
      const isBlocked = blockedRanges.some(r => t >= r.start && t < r.end)
      if (t >= minStart && !bookedTimes.has(t) && !isBlocked) slots.push(new Date(cur))
      cur = addMinutes(cur, a.slot_duration_minutes)
    }
  }
  return slots
}
