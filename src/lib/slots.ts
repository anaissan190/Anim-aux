// src/lib/slots.ts
// Génération des créneaux réservables d'une journée — extrait de
// useAvailableSlots (useData.ts) en fonction pure pour être testable sans
// mocker Supabase. Ne s'occupe que du calcul une fois les données déjà
// chargées (disponibilités, créneaux déjà réservés, congés) ; ne fait
// aucun accès réseau.

import { addMinutes } from 'date-fns'

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
  for (const a of availabilities) {
    const [sh, sm] = a.start_time.split(':').map(Number)
    const [eh, em] = a.end_time.split(':').map(Number)
    let cur = new Date(date)
    cur.setHours(sh, sm, 0, 0)
    const end = new Date(date)
    end.setHours(eh, em, 0, 0)
    while (cur < end) {
      const t = cur.getTime()
      const isBlocked = blockedRanges.some(r => t >= r.start && t < r.end)
      if (t >= minStart && !bookedTimes.has(t) && !isBlocked) slots.push(new Date(cur))
      cur = addMinutes(cur, a.slot_duration_minutes)
    }
  }
  return slots
}
