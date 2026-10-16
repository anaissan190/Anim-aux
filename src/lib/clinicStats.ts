// src/lib/clinicStats.ts
// Statistiques d'un CABINET (visibles par son créateur) : le même contenu que l'onglet
// Statistiques d'un praticien seul, pour tout le cabinet ou pour un praticien choisi, plus un
// comparatif entre praticiens. Calculs purs, testés dans clinicStats.test.ts ; les mises en page
// sont dans components/doctor/ClinicStatsPanel.tsx.
import {
  computeDoctorStats, computeMonthlyComparison, priceByDoctor,
  type DoctorAvailabilityRule, type ExtendedStatsAppointment, type MonthlyComparison, type ReviewForStats,
} from './doctorStats'

export interface ClinicMemberForStats {
  doctor_id: string
  doctors?: {
    consultation_price?: number | null
    profiles?: { first_name?: string | null; last_name?: string | null } | null
  } | null
}

export interface ClinicAppointmentForStats extends ExtendedStatsAppointment {
  doctor_id?: string
}

export interface ClinicAvailabilityForStats extends DoctorAvailabilityRule {
  doctor_id?: string
}

export interface ClinicReviewForStats extends ReviewForStats {
  doctor_id?: string
}

export function memberName(m: ClinicMemberForStats): string {
  const p = m.doctors?.profiles
  return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Praticien'
}

// Tarif de consultation de chaque praticien du cabinet (0 s'il n'en a pas renseigné).
export function clinicPrices(members: ClinicMemberForStats[]): Record<string, number> {
  return Object.fromEntries(members.map(m => [m.doctor_id, m.doctors?.consultation_price ?? 0]))
}

// `doctorId` null = tout le cabinet.
export function filterByDoctor<T extends { doctor_id?: string }>(items: T[], doctorId: string | null): T[] {
  return doctorId ? items.filter(i => i.doctor_id === doctorId) : items
}

// Note moyenne (une décimale) et nombre d'avis d'une liste d'avis ; 0 / 0 s'il n'y en a pas.
export function reviewSummary(reviews: { rating: number }[]): { average: number; count: number } {
  if (reviews.length === 0) return { average: 0, count: 0 }
  const total = reviews.reduce((t, r) => t + r.rating, 0)
  return { average: Math.round((total / reviews.length) * 10) / 10, count: reviews.length }
}

export interface ClinicStatsRow {
  doctorId: string | null // null = ligne « Tout le cabinet »
  name: string
  completedThisMonth: number
  revenueThisMonth: number
  revenueLast30Days: number
  noShowRate: number | null
  cancellationRate: number | null
  fillRate: number | null
  rating: number | null // null = aucun avis
  reviewCount: number
}

export interface ClinicStatsTable {
  rows: ClinicStatsRow[]
  total: ClinicStatsRow
}

export function clinicStatsTable(
  members: ClinicMemberForStats[],
  appointments: ClinicAppointmentForStats[],
  availabilities: ClinicAvailabilityForStats[],
  reviews: ClinicReviewForStats[],
  now: Date = new Date(),
): ClinicStatsTable {
  const price = priceByDoctor(clinicPrices(members))
  const build = (doctorId: string | null, name: string): ClinicStatsRow => {
    const appts = filterByDoctor(appointments, doctorId)
    const stats = computeDoctorStats(appts, filterByDoctor(availabilities, doctorId), price, now)
    const month = computeMonthlyComparison(appts, price, now).current
    const rev = reviewSummary(filterByDoctor(reviews, doctorId))
    return {
      doctorId,
      name,
      completedThisMonth: month.completed,
      revenueThisMonth: month.revenue,
      revenueLast30Days: stats.revenueLast30Days,
      noShowRate: stats.noShowRate,
      cancellationRate: stats.cancellationRate,
      fillRate: stats.fillRate,
      rating: rev.count > 0 ? rev.average : null,
      reviewCount: rev.count,
    }
  }
  return {
    rows: members.map(m => build(m.doctor_id, memberName(m))),
    total: build(null, 'Tout le cabinet'),
  }
}

// Mois en cours et mois précédent pour TOUT le cabinet (revenu au tarif de chaque praticien) :
// les indicateurs de la vue d'ensemble, avec leur évolution.
export function clinicMonthlyTotals(
  members: ClinicMemberForStats[],
  appointments: ClinicAppointmentForStats[],
  now: Date = new Date(),
): MonthlyComparison {
  return computeMonthlyComparison(appointments, priceByDoctor(clinicPrices(members)), now)
}

// Rendez-vous passés jamais clôturés (ni « Terminé » ni « Absent » ni annulés) : tant qu'ils
// traînent, les statistiques de revenu et d'absence sont faussées.
export function unclosedPastCount(appointments: { start_at: string; status: string }[], now: Date = new Date()): number {
  return appointments.filter(a => new Date(a.start_at) < now && (a.status === 'pending' || a.status === 'confirmed')).length
}

export interface UpcomingAppointment {
  id: string
  startAt: string
  doctorName: string
  // Animaux concernés, sinon le motif ; vide s'il n'y a ni l'un ni l'autre
  label: string
  patientName: string
}

// Les prochains rendez-vous de tout le cabinet (confirmés ou en attente), du plus proche au plus
// lointain : de quoi voir d'un coup d'œil ce qui arrive sans ouvrir le calendrier.
export function upcomingAppointments(
  appointments: {
    id?: string; start_at: string; status: string; doctor_id?: string; reason?: string
    animals?: { name?: string }[]
    patientProfile?: { first_name?: string | null; last_name?: string | null } | null
  }[],
  members: ClinicMemberForStats[],
  now: Date = new Date(),
  limit = 5,
): UpcomingAppointment[] {
  const nameById = new Map(members.map(m => [m.doctor_id, memberName(m)]))
  return appointments
    .filter(a => new Date(a.start_at) >= now && (a.status === 'pending' || a.status === 'confirmed'))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, limit)
    .map((a, i) => {
      const animals = (a.animals ?? []).map(x => x.name).filter(Boolean).join(', ')
      const p = a.patientProfile
      return {
        id: a.id ?? `${a.start_at}-${i}`,
        startAt: a.start_at,
        doctorName: (a.doctor_id && nameById.get(a.doctor_id)) || 'Praticien',
        label: animals || (a.reason ?? '').split(' — ')[0].trim(),
        patientName: [p?.first_name, p?.last_name].filter(Boolean).join(' '),
      }
    })
}
