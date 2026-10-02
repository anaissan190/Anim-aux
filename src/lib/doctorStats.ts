// src/lib/doctorStats.ts
// Calculs de l'onglet "Statistiques" du tableau de bord praticien —
// extraits de DoctorDashboard.tsx en fonction pure pour être testables
// sans avoir à monter le composant ni mocker Supabase.
import { parisDateKey, parisDayOfWeek, parisHour, parisMonthKey, shiftMonthKey } from './parisTime'

export interface DoctorStatsAppointment {
  start_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
}

export interface DoctorAvailabilityRule {
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_minutes?: number | null
}

export interface DoctorStats {
  noShowRate: number | null
  cancellationRate: number | null
  totalRevenue: number
  revenueLast30Days: number
  fillRate: number | null
  hasUnclosedPastAppts: boolean
}

export function computeDoctorStats(
  appointments: DoctorStatsAppointment[],
  availabilities: DoctorAvailabilityRule[],
  consultationPrice: number,
  now: Date = new Date()
): DoctorStats {
  const price = consultationPrice || 0
  const pastAppts = appointments.filter(a => new Date(a.start_at) < now)
  const completedAppts = pastAppts.filter(a => a.status === 'completed')
  const noShowAppts = pastAppts.filter(a => a.status === 'no_show')
  const cancelledAppts = pastAppts.filter(a => a.status === 'cancelled')

  const noShowRate = completedAppts.length + noShowAppts.length > 0
    ? Math.round((noShowAppts.length / (completedAppts.length + noShowAppts.length)) * 100)
    : null
  const cancellationRate = pastAppts.length > 0
    ? Math.round((cancelledAppts.length / pastAppts.length) * 100)
    : null
  const totalRevenue = completedAppts.length * price

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const revenueLast30Days = completedAppts
    .filter(a => new Date(a.start_at) >= thirtyDaysAgo).length * price

  const bookedLast30Days = appointments.filter(a => {
    const d = new Date(a.start_at)
    return d >= thirtyDaysAgo && d < now && a.status !== 'cancelled'
  }).length

  // Créneaux théoriques sur les 30 derniers jours d'après les disponibilités
  // récurrentes (jour de la semaine × durée / slot_duration_minutes) — ne
  // tient pas compte des congés (blocked_slots), donc légèrement
  // surestimé : un indicateur, pas une mesure exacte.
  // i <= 30 (31 valeurs) plutôt que i < 30 : bookedLast30Days compte les RDV
  // jusqu'à `now` inclus (donc ceux du jour même, même partiel), alors que
  // ce calcul s'arrêtait la veille — le jour courant gonflait le numérateur
  // sans jamais compter ses créneaux théoriques au dénominateur.
  let theoreticalSlots30Days = 0
  for (let i = 0; i <= 30; i++) {
    const day = new Date(thirtyDaysAgo)
    day.setDate(day.getDate() + i)
    // Ancré sur le jour calendaire à Paris (src/lib/parisTime.ts), pas sur
    // le fuseau local de l'appareil — sinon un praticien en voyage voit un
    // taux de remplissage calculé contre les mauvais jours de la semaine.
    const dayOfWeek = parisDayOfWeek(parisDateKey(day))
    availabilities.filter(a => a.day_of_week === dayOfWeek).forEach(a => {
      const [sh, sm] = a.start_time.split(':').map(Number)
      const [eh, em] = a.end_time.split(':').map(Number)
      const minutes = (eh * 60 + em) - (sh * 60 + sm)
      theoreticalSlots30Days += Math.max(0, Math.floor(minutes / (a.slot_duration_minutes || 30)))
    })
  }
  const fillRate = theoreticalSlots30Days > 0
    ? Math.min(100, Math.round((bookedLast30Days / theoreticalSlots30Days) * 100))
    : null

  // Le revenu et le taux de no-show ne comptent que les RDV explicitement
  // clôturés (boutons Terminé/Absent sur AppointmentCard) — un praticien
  // qui n'a jamais l'habitude de les cliquer voit sinon des stats à 0
  // sans comprendre pourquoi, alors qu'il a bien eu des RDV passés.
  const hasUnclosedPastAppts = pastAppts.length > 0 && completedAppts.length === 0 && noShowAppts.length === 0

  return { noShowRate, cancellationRate, totalRevenue, revenueLast30Days, fillRate, hasUnclosedPastAppts }
}

// ── Compléments d'octobre 2026 (demande d'Anaïs d'enrichir l'onglet) ───────
// Un rendez-vous "enrichi" : mêmes champs que DoctorStatsAppointment, plus
// tout ce que useDoctorAppointments embarque déjà (patient_id, reason,
// created_at, updated_at, confirmed_by_patient_at, animaux liés) — rien de
// nouveau à charger côté réseau pour ces calculs.
export interface ExtendedStatsAppointment extends DoctorStatsAppointment {
  patient_id: string
  reason?: string
  created_at?: string
  updated_at?: string
  confirmed_by_patient_at?: string
  animals?: { species: string }[]
}

export interface ReviewForStats {
  rating: number
  created_at: string
  doctor_reply?: string | null
}

// Évolution en pourcentage par rapport à une valeur de référence. `null`
// quand la référence est 0 : "+∞ %" ou une division par zéro induiraient en
// erreur plutôt que d'informer — l'appelant affiche alors l'écart brut
// (ex. "+4") plutôt qu'un pourcentage.
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export interface MonthBreakdown {
  monthKey: string
  completed: number
  cancelled: number
  noShow: number
}

// Répartition terminés/annulés/absences sur les `months` derniers mois
// (le mois courant inclus, même partiel) — pour l'histogramme empilé de
// l'onglet Statistiques.
export function monthlyBreakdown(
  appointments: ExtendedStatsAppointment[],
  now: Date = new Date(),
  months = 6
): MonthBreakdown[] {
  const currentKey = parisMonthKey(now)
  const keys = Array.from({ length: months }, (_, i) => shiftMonthKey(currentKey, i - (months - 1)))
  const byMonth = new Map<string, MonthBreakdown>(keys.map(k => [k, { monthKey: k, completed: 0, cancelled: 0, noShow: 0 }]))
  for (const a of appointments) {
    const bucket = byMonth.get(parisMonthKey(new Date(a.start_at)))
    if (!bucket) continue
    if (a.status === 'completed') bucket.completed++
    else if (a.status === 'cancelled') bucket.cancelled++
    else if (a.status === 'no_show') bucket.noShow++
  }
  return keys.map(k => byMonth.get(k)!)
}

export interface MonthlyKpi {
  completed: number
  revenue: number
  noShowRate: number | null
  cancellationRate: number | null
}

export interface MonthlyComparison {
  current: MonthlyKpi
  previous: MonthlyKpi
}

// Les 4 indicateurs "ce mois-ci" de l'onglet Statistiques, comparés au mois
// calendaire précédent — distinct de la fenêtre glissante "30 derniers
// jours" de computeDoctorStats ci-dessus, qui reste utilisée pour le taux de
// remplissage (dépend des disponibilités, pas du mois calendaire).
export function computeMonthlyComparison(
  appointments: ExtendedStatsAppointment[],
  consultationPrice: number,
  now: Date = new Date()
): MonthlyComparison {
  const price = consultationPrice || 0
  const kpiFor = (monthKey: string): MonthlyKpi => {
    const inMonth = appointments.filter(a => parisMonthKey(new Date(a.start_at)) === monthKey)
    const completed = inMonth.filter(a => a.status === 'completed')
    const noShow = inMonth.filter(a => a.status === 'no_show')
    const cancelled = inMonth.filter(a => a.status === 'cancelled')
    const closedOrNoShow = completed.length + noShow.length
    return {
      completed: completed.length,
      revenue: completed.length * price,
      noShowRate: closedOrNoShow > 0 ? Math.round((noShow.length / closedOrNoShow) * 100) : null,
      cancellationRate: inMonth.length > 0 ? Math.round((cancelled.length / inMonth.length) * 100) : null,
    }
  }
  const currentKey = parisMonthKey(now)
  return { current: kpiFor(currentKey), previous: kpiFor(shiftMonthKey(currentKey, -1)) }
}

export interface WeekdayCount { dayOfWeek: number; count: number }

// Nombre de RDV (hors annulés) par jour de semaine sur les `windowDays`
// derniers jours — pour reconnaître les jours à ouvrir/fermer des créneaux.
export function busiestWeekdays(
  appointments: ExtendedStatsAppointment[],
  now: Date = new Date(),
  windowDays = 90
): WeekdayCount[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - windowDays)
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const a of appointments) {
    if (a.status === 'cancelled') continue
    const d = new Date(a.start_at)
    if (d < cutoff || d > now) continue
    counts[parisDayOfWeek(parisDateKey(d))]++
  }
  return counts.map((count, dayOfWeek) => ({ dayOfWeek, count }))
}

export interface HourCount { hour: number; count: number }

// Nombre de RDV (hors annulés) par heure de la journée, sur les derniers
// `windowDays` jours — seules les heures ayant effectivement eu au moins un
// RDV apparaissent (une heure jamais utilisée, ex. 3h du matin, n'a aucun
// sens à qualifier de "creuse"). Triée par heure croissante ; l'appelant
// prend le minimum et le maximum pour "heure la plus chargée"/"la plus
// calme".
export function appointmentsByHour(
  appointments: ExtendedStatsAppointment[],
  now: Date = new Date(),
  windowDays = 90
): HourCount[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - windowDays)
  const counts = new Map<number, number>()
  for (const a of appointments) {
    if (a.status === 'cancelled') continue
    const d = new Date(a.start_at)
    if (d < cutoff || d > now) continue
    const hour = parisHour(d)
    counts.set(hour, (counts.get(hour) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour)
}

export interface NewVsReturning { new: number; returning: number }

// Patients vus ce mois-ci (RDV terminé), répartis entre "nouveau" (aucun RDV
// terminé avant ce mois) et "déjà venu".
export function newVsReturningPatients(
  appointments: ExtendedStatsAppointment[],
  now: Date = new Date()
): NewVsReturning {
  const monthKey = parisMonthKey(now)
  const completed = appointments.filter(a => a.status === 'completed')
  const patientsThisMonth = new Set(
    completed.filter(a => parisMonthKey(new Date(a.start_at)) === monthKey).map(a => a.patient_id)
  )
  let result = { new: 0, returning: 0 }
  for (const patientId of patientsThisMonth) {
    const hadBefore = completed.some(
      a => a.patient_id === patientId && parisMonthKey(new Date(a.start_at)) < monthKey
    )
    result = hadBefore ? { ...result, returning: result.returning + 1 } : { ...result, new: result.new + 1 }
  }
  return result
}

export interface ReasonCount { reason: string; count: number }

// Le motif d'un RDV est stocké "<motif choisi> — <détails libres>" (liste
// fermée définie par métier, voir BookPage.tsx REASONS/VET_REASONS) : on ne
// garde que la partie avant " — ", jamais les détails en texte libre tapés
// par le patient.
export function topReasons(appointments: { reason?: string }[], limit = 5): ReasonCount[] {
  const counts = new Map<string, number>()
  for (const a of appointments) {
    const main = a.reason?.split(' — ')[0].trim()
    if (!main) continue
    counts.set(main, (counts.get(main) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export interface SpeciesCount { species: string; count: number }

// Espèces des animaux vus (hors RDV annulés), triées par fréquence.
export function speciesBreakdown(appointments: { status: string; animals?: { species: string }[] }[]): SpeciesCount[] {
  const counts = new Map<string, number>()
  for (const a of appointments) {
    if (a.status === 'cancelled') continue
    for (const animal of a.animals ?? []) {
      counts.set(animal.species, (counts.get(animal.species) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count)
}

// Délai moyen (en jours) entre la réservation et le rendez-vous. Les RDV
// annulés sont exclus (le délai initialement visé n'a plus de sens) ; un
// écart négatif (created_at postérieur à start_at) est ignoré comme donnée
// corrompue plutôt que de fausser la moyenne.
export function averageBookingLeadTimeDays(
  appointments: { start_at: string; created_at?: string; status: string }[]
): number | null {
  const samples = appointments
    .filter(a => a.status !== 'cancelled' && a.created_at)
    .map(a => (new Date(a.start_at).getTime() - new Date(a.created_at!).getTime()) / 86_400_000)
    .filter(d => d >= 0)
  if (samples.length === 0) return null
  return Math.round((samples.reduce((s, d) => s + d, 0) / samples.length) * 10) / 10
}

// Part des annulations survenues moins de 24h avant le RDV. `updated_at`
// sert de date d'annulation : la table n'a pas de colonne cancelled_at
// dédiée, mais useUpdateAppointmentStatus pose explicitement updated_at =
// maintenant à chaque changement de statut (voir useData.ts) — une
// approximation fiable en pratique, pas une garantie absolue si un jour une
// autre mutation touchait le statut sans mettre à jour ce champ.
export function lateCancellationRate(
  appointments: { status: string; start_at: string; updated_at?: string }[]
): number | null {
  const cancelled = appointments.filter(a => a.status === 'cancelled' && a.updated_at)
  if (cancelled.length === 0) return null
  const late = cancelled.filter(a => {
    const hoursBefore = (new Date(a.start_at).getTime() - new Date(a.updated_at!).getTime()) / 3_600_000
    return hoursBefore < 24
  })
  return Math.round((late.length / cancelled.length) * 100)
}

// Part des RDV passés (hors annulés) où le patient a cliqué "Je confirme ma
// présence" dans le rappel à 24h — à lire à côté du taux de no-show, pas
// comme une mesure isolée.
export function presenceConfirmationRate(
  appointments: { status: string; confirmed_by_patient_at?: string; start_at: string }[],
  now: Date = new Date()
): number | null {
  const past = appointments.filter(
    a => new Date(a.start_at) < now && (a.status === 'completed' || a.status === 'no_show')
  )
  if (past.length === 0) return null
  const confirmed = past.filter(a => !!a.confirmed_by_patient_at)
  return Math.round((confirmed.length / past.length) * 100)
}

export interface ReviewMonthlyStats {
  averageRatingCurrentMonth: number | null
  averageRatingPreviousMonth: number | null
  reviewsCurrentMonth: number
  responseRate: number | null
}

// La note moyenne et le nombre total d'avis "depuis toujours" sont déjà
// maintenus par trigger sur doctors.average_rating/review_count (affichés
// ailleurs) — inutile de les recalculer ici. Cette fonction ne couvre que ce
// qu'eux ne donnent pas : l'évolution mois par mois et le taux de réponse.
export function computeReviewStats(reviews: ReviewForStats[], now: Date = new Date()): ReviewMonthlyStats {
  const currentKey = parisMonthKey(now)
  const previousKey = shiftMonthKey(currentKey, -1)
  const avgFor = (monthKey: string): number | null => {
    const inMonth = reviews.filter(r => parisMonthKey(new Date(r.created_at)) === monthKey)
    return inMonth.length > 0
      ? Math.round((inMonth.reduce((s, r) => s + r.rating, 0) / inMonth.length) * 10) / 10
      : null
  }
  const responded = reviews.filter(r => !!r.doctor_reply).length
  return {
    averageRatingCurrentMonth: avgFor(currentKey),
    averageRatingPreviousMonth: avgFor(previousKey),
    reviewsCurrentMonth: reviews.filter(r => parisMonthKey(new Date(r.created_at)) === currentKey).length,
    responseRate: reviews.length > 0 ? Math.round((responded / reviews.length) * 100) : null,
  }
}

export interface PatientToReengage {
  patientId: string
  lastCompletedAt: string
  monthsAgo: number
}

// Patients dont le dernier RDV terminé remonte à plus de `thresholdDays`
// (180 par défaut, même seuil que la relance automatique par email — voir
// send-reminders/index.ts) — pour que le praticien les recontacte lui-même,
// triés du plus ancien au plus récent.
export function patientsToReengage(
  appointments: ExtendedStatsAppointment[],
  now: Date = new Date(),
  thresholdDays = 180
): PatientToReengage[] {
  const lastByPatient = new Map<string, string>()
  for (const a of appointments) {
    if (a.status !== 'completed') continue
    const prev = lastByPatient.get(a.patient_id)
    if (!prev || new Date(a.start_at) > new Date(prev)) lastByPatient.set(a.patient_id, a.start_at)
  }
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - thresholdDays)
  const result: PatientToReengage[] = []
  for (const [patientId, lastCompletedAt] of lastByPatient) {
    const lastDate = new Date(lastCompletedAt)
    if (lastDate < cutoff) {
      const monthsAgo = Math.floor((now.getTime() - lastDate.getTime()) / (30 * 86_400_000))
      result.push({ patientId, lastCompletedAt, monthsAgo })
    }
  }
  return result.sort((a, b) => b.monthsAgo - a.monthsAgo)
}

// Part des patients ayant eu au moins 2 RDV terminés, parmi tous les
// patients ayant eu au moins 1 RDV terminé — un indicateur de fidélisation.
export function patientReturnRate(appointments: ExtendedStatsAppointment[]): number | null {
  const countByPatient = new Map<string, number>()
  for (const a of appointments) {
    if (a.status !== 'completed') continue
    countByPatient.set(a.patient_id, (countByPatient.get(a.patient_id) ?? 0) + 1)
  }
  if (countByPatient.size === 0) return null
  const returning = [...countByPatient.values()].filter(c => c >= 2).length
  return Math.round((returning / countByPatient.size) * 100)
}
