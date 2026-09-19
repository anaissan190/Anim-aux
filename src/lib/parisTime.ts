// src/lib/parisTime.ts
// Ancre la génération/l'affichage des créneaux de rendez-vous sur le fuseau
// Europe/Paris, plutôt que sur celui de l'appareil du visiteur — Animéaux
// est un marché exclusivement français, et la validation serveur des
// créneaux (migration 088, trigger validate_patient_appointment_slot) est
// elle-même ancrée sur Europe/Paris. Mais tout le calcul client
// (AvailabilityCalendar, generateAvailableSlots, useAvailableSlots,
// BookPage) utilisait jusqu'ici les méthodes natives de Date (getDay,
// getHours, setHours...), qui lisent le fuseau LOCAL du navigateur. Un
// patient ou praticien connecté depuis un autre fuseau horaire (voyage)
// voyait donc des créneaux calculés dans SON fuseau, que la validation
// serveur rejetait ensuite comme hors disponibilité — repéré le 10/09/2026
// en testant une réservation depuis la Malaisie (UTC+8, 6h d'écart avec
// Paris) : un "11:30" choisi là-bas correspondait en réalité à 05:30 heure
// de Paris, hors des horaires du praticien.
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

export const PARIS_TZ = 'Europe/Paris'

// "yyyy-MM-dd" du jour calendaire à Paris pour l'instant donné (par défaut :
// maintenant) — sert de clé neutre pour comparer/construire des dates sans
// dépendre du fuseau de l'appareil.
export function parisDateKey(date: Date = new Date()): string {
  return formatInTimeZone(date, PARIS_TZ, 'yyyy-MM-dd')
}

// Jour de semaine (0=dimanche...6=samedi, même convention que
// availabilities.day_of_week) d'une clé de date calendaire. Propriété
// purement calendaire (indépendante de toute heure/fuseau) : ancrée sur UTC
// pour ce calcul précis, ce qui ne pose aucun problème puisqu'aucune heure
// n'entre en jeu.
export function parisDayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay()
}

// Instant réel (UTC) correspondant à une heure murale (HH:mm ou HH:mm:ss)
// donnée le jour calendaire "yyyy-MM-dd", heure de Paris.
export function parisTimeToUtc(dateKey: string, time: string): Date {
  return fromZonedTime(`${dateKey}T${time}`, PARIS_TZ)
}

// "HH:mm" de l'heure murale à Paris pour l'instant donné.
export function parisTimeString(date: Date): string {
  return formatInTimeZone(date, PARIS_TZ, 'HH:mm')
}

// Minutes depuis minuit (heure murale à Paris) pour l'instant donné —
// pratique pour comparer/positionner un créneau contre des bornes
// start_time/end_time ("HH:mm") venant de la base.
export function parisMinutesOfDay(date: Date): number {
  const [h, m] = parisTimeString(date).split(':').map(Number)
  return h * 60 + m
}

// Décale une clé de date calendaire de N jours (négatif accepté). Arithmétique
// purement calendaire, ancrée sur UTC (même principe que parisDayOfWeek) —
// n'utilise jamais date-fns (addDays, startOfWeek...) sur un objet Date
// "local", qui relirait le fuseau de l'appareil et redonnerait le même bug.
export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Lundi de la semaine (weekStartsOn: 1) contenant la clé de date donnée.
export function parisStartOfWeekKey(dateKey: string): string {
  const dow = parisDayOfWeek(dateKey) // 0=dimanche...6=samedi
  const daysSinceMonday = dow === 0 ? 6 : dow - 1
  return addDaysToDateKey(dateKey, -daysSinceMonday)
}

// Nombre de jours calendaires (à Paris) entre `from` et `target` — négatif
// si `target` est dans le passé. Équivalent Paris-anchoré de
// date-fns' differenceInCalendarDays, qui lit le fuseau local de l'appareil.
export function parisCalendarDaysDiff(target: Date, from: Date = new Date()): number {
  const targetUtc = new Date(`${parisDateKey(target)}T00:00:00Z`).getTime()
  const fromUtc = new Date(`${parisDateKey(from)}T00:00:00Z`).getTime()
  return Math.round((targetUtc - fromUtc) / 86_400_000)
}
