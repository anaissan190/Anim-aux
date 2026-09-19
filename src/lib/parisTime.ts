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
