// src/lib/doctorStats.ts
// Calculs de l'onglet "Statistiques" du tableau de bord praticien —
// extraits de DoctorDashboard.tsx en fonction pure pour être testables
// sans avoir à monter le composant ni mocker Supabase.

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
    const dayOfWeek = day.getDay()
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
