import { describe, it, expect } from 'vitest'
import {
  computeDoctorStats, type DoctorStatsAppointment, type DoctorAvailabilityRule,
  percentDelta, monthlyBreakdown, computeMonthlyComparison, busiestWeekdays, appointmentsByHour,
  newVsReturningPatients, topReasons, speciesBreakdown, averageBookingLeadTimeDays, lateCancellationRate,
  presenceConfirmationRate, computeReviewStats, patientsToReengage, patientReturnRate,
  type ExtendedStatsAppointment, type ReviewForStats,
} from './doctorStats'
import { parisDateKey, parisDayOfWeek } from './parisTime'

// Horloge de référence fixe pour des tests déterministes.
const NOW = new Date('2026-07-23T12:00:00Z')
// Jour de semaine à Paris de NOW — jamais NOW.getDay() (lirait le fuseau
// LOCAL du runner, qui tourne en Asia/Kuala_Lumpur dans cet environnement).
const NOW_DOW = parisDayOfWeek(parisDateKey(NOW))

function daysAgo(n: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function daysAhead(n: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

describe('computeDoctorStats', () => {
  it('renvoie des valeurs neutres sans aucun rendez-vous', () => {
    const stats = computeDoctorStats([], [], 100, NOW)
    expect(stats).toEqual({
      noShowRate: null,
      cancellationRate: null,
      totalRevenue: 0,
      revenueLast30Days: 0,
      fillRate: null,
      hasUnclosedPastAppts: false,
    })
  })

  it('ignore les rendez-vous futurs dans tous les calculs', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAhead(2), status: 'confirmed' },
      { start_at: daysAhead(10), status: 'confirmed' },
    ]
    const stats = computeDoctorStats(appts, [], 100, NOW)
    expect(stats.totalRevenue).toBe(0)
    expect(stats.noShowRate).toBeNull()
    expect(stats.cancellationRate).toBeNull()
    expect(stats.hasUnclosedPastAppts).toBe(false)
  })

  it('calcule le revenu total à partir des seuls RDV terminés', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(5), status: 'completed' },
      { start_at: daysAgo(10), status: 'completed' },
      { start_at: daysAgo(3), status: 'cancelled' },
      { start_at: daysAgo(1), status: 'no_show' },
    ]
    const stats = computeDoctorStats(appts, [], 50, NOW)
    expect(stats.totalRevenue).toBe(100) // 2 terminés × 50€
  })

  it('exclut du revenu "30 derniers jours" les RDV terminés plus anciens', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(10), status: 'completed' },
      { start_at: daysAgo(45), status: 'completed' }, // hors fenêtre 30j
    ]
    const stats = computeDoctorStats(appts, [], 100, NOW)
    expect(stats.totalRevenue).toBe(200)
    expect(stats.revenueLast30Days).toBe(100)
  })

  it('calcule le taux de no-show en excluant les annulations du dénominateur', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(1), status: 'completed' },
      { start_at: daysAgo(2), status: 'completed' },
      { start_at: daysAgo(3), status: 'completed' },
      { start_at: daysAgo(4), status: 'no_show' },
      { start_at: daysAgo(5), status: 'cancelled' }, // ne compte ni au numérateur ni au dénominateur
    ]
    const stats = computeDoctorStats(appts, [], 100, NOW)
    // 1 no_show / (3 completed + 1 no_show) = 25%
    expect(stats.noShowRate).toBe(25)
  })

  it('calcule le taux d\'annulation sur l\'ensemble des RDV passés', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(1), status: 'completed' },
      { start_at: daysAgo(2), status: 'cancelled' },
      { start_at: daysAgo(3), status: 'cancelled' },
      { start_at: daysAgo(4), status: 'no_show' },
    ]
    const stats = computeDoctorStats(appts, [], 100, NOW)
    // 2 cancelled / 4 RDV passés = 50%
    expect(stats.cancellationRate).toBe(50)
  })

  it('signale hasUnclosedPastAppts si des RDV passés existent mais aucun n\'est clôturé', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(1), status: 'confirmed' },
      { start_at: daysAgo(2), status: 'pending' },
    ]
    const stats = computeDoctorStats(appts, [], 100, NOW)
    expect(stats.hasUnclosedPastAppts).toBe(true)
    expect(stats.noShowRate).toBeNull()
  })

  it('ne signale pas hasUnclosedPastAppts dès qu\'au moins un RDV est clôturé', () => {
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(1), status: 'confirmed' },
      { start_at: daysAgo(2), status: 'completed' },
    ]
    const stats = computeDoctorStats(appts, [], 100, NOW)
    expect(stats.hasUnclosedPastAppts).toBe(false)
  })

  it('renvoie fillRate null sans disponibilités renseignées', () => {
    const stats = computeDoctorStats(
      [{ start_at: daysAgo(1), status: 'completed' }], [], 100, NOW
    )
    expect(stats.fillRate).toBeNull()
  })

  it('calcule le taux de remplissage à partir des disponibilités récurrentes', () => {
    // NOW = jeudi 23/07/2026 (UTC). Une seule disponibilité le jeudi,
    // 09:00-11:00, créneaux de 30 min → 4 créneaux théoriques par jeudi
    // couvert sur les 30 derniers jours.
    const availabilities: DoctorAvailabilityRule[] = [
      { day_of_week: NOW_DOW, start_time: '09:00', end_time: '11:00', slot_duration_minutes: 30 },
    ]
    // Un seul RDV réservé (non annulé) dans la fenêtre des 30 derniers jours.
    const appts: DoctorStatsAppointment[] = [
      { start_at: daysAgo(2), status: 'confirmed' },
    ]
    const stats = computeDoctorStats(appts, availabilities, 100, NOW)
    expect(stats.fillRate).not.toBeNull()
    expect(stats.fillRate).toBeGreaterThan(0)
    expect(stats.fillRate).toBeLessThanOrEqual(100)
  })

  it('exclut les RDV annulés du nombre de créneaux réservés (fillRate)', () => {
    const availabilities: DoctorAvailabilityRule[] = [
      { day_of_week: NOW_DOW, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
    ]
    const confirmedOnly = computeDoctorStats(
      [{ start_at: daysAgo(2), status: 'confirmed' }], availabilities, 100, NOW
    )
    const cancelledOnly = computeDoctorStats(
      [{ start_at: daysAgo(2), status: 'cancelled' }], availabilities, 100, NOW
    )
    expect(cancelledOnly.fillRate).toBe(0)
    expect(confirmedOnly.fillRate).toBeGreaterThan(cancelledOnly.fillRate!)
  })

  it('plafonne le taux de remplissage à 100%', () => {
    // Une seule disponibilité de 30 minutes sur toute la période, mais 30
    // RDV réservés dans la fenêtre → largement plus que le théorique.
    const availabilities: DoctorAvailabilityRule[] = [
      { day_of_week: NOW_DOW, start_time: '09:00', end_time: '09:30', slot_duration_minutes: 30 },
    ]
    const appts: DoctorStatsAppointment[] = Array.from({ length: 30 }, (_, i) => ({
      start_at: daysAgo(i + 1), status: 'confirmed' as const,
    }))
    const stats = computeDoctorStats(appts, availabilities, 100, NOW)
    expect(stats.fillRate).toBe(100)
  })

  it('utilise 30 minutes par défaut si slot_duration_minutes est absent', () => {
    const availabilities: DoctorAvailabilityRule[] = [
      { day_of_week: NOW_DOW, start_time: '09:00', end_time: '10:00' },
    ]
    const stats = computeDoctorStats([], availabilities, 100, NOW)
    // Ne doit pas planter ni renvoyer Infinity/NaN malgré l'absence du champ.
    expect(stats.fillRate).toBe(0)
  })
})

// NOW = 23 juillet 2026 12:00 UTC = mois "2026-07" à Paris. Mois précédent : "2026-06".
describe('percentDelta', () => {
  it('calcule une évolution positive', () => {
    expect(percentDelta(120, 100)).toBe(20)
  })
  it('calcule une évolution négative', () => {
    expect(percentDelta(80, 100)).toBe(-20)
  })
  it('renvoie null si la référence est 0, même si le nouveau nombre est 0 aussi', () => {
    expect(percentDelta(0, 0)).toBeNull()
    expect(percentDelta(5, 0)).toBeNull()
  })
})

describe('monthlyBreakdown', () => {
  it('répartit les RDV par mois calendaire (à Paris), mois courant inclus', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'p1', start_at: '2026-07-10T10:00:00Z', status: 'completed' },
      { patient_id: 'p2', start_at: '2026-07-15T10:00:00Z', status: 'cancelled' },
      { patient_id: 'p3', start_at: '2026-06-10T10:00:00Z', status: 'no_show' },
      { patient_id: 'p4', start_at: '2026-01-01T10:00:00Z', status: 'completed' }, // hors fenêtre de 3 mois
    ]
    const result = monthlyBreakdown(appts, NOW, 3)
    expect(result.map(m => m.monthKey)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(result.find(m => m.monthKey === '2026-07')).toEqual({ monthKey: '2026-07', completed: 1, cancelled: 1, noShow: 0 })
    expect(result.find(m => m.monthKey === '2026-06')).toEqual({ monthKey: '2026-06', completed: 0, cancelled: 0, noShow: 1 })
    expect(result.find(m => m.monthKey === '2026-05')).toEqual({ monthKey: '2026-05', completed: 0, cancelled: 0, noShow: 0 })
  })
})

describe('computeMonthlyComparison', () => {
  it('compare le mois courant au mois précédent', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'p1', start_at: '2026-07-05T10:00:00Z', status: 'completed' },
      { patient_id: 'p2', start_at: '2026-07-06T10:00:00Z', status: 'completed' },
      { patient_id: 'p3', start_at: '2026-07-07T10:00:00Z', status: 'cancelled' },
      { patient_id: 'p4', start_at: '2026-06-05T10:00:00Z', status: 'completed' },
      { patient_id: 'p5', start_at: '2026-06-06T10:00:00Z', status: 'no_show' },
    ]
    const cmp = computeMonthlyComparison(appts, 50, NOW)
    expect(cmp.current).toEqual({ completed: 2, revenue: 100, noShowRate: 0, cancellationRate: 33 })
    expect(cmp.previous).toEqual({ completed: 1, revenue: 50, noShowRate: 50, cancellationRate: 0 })
  })

  it('renvoie des taux neutres pour un mois sans aucun RDV', () => {
    const cmp = computeMonthlyComparison([], 50, NOW)
    expect(cmp.current).toEqual({ completed: 0, revenue: 0, noShowRate: null, cancellationRate: null })
  })
})

describe('busiestWeekdays', () => {
  it('compte les RDV non annulés par jour de semaine, hors fenêtre exclue', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'p1', start_at: daysAgo(1), status: 'completed' },
      { patient_id: 'p2', start_at: daysAgo(1), status: 'completed' },
      { patient_id: 'p3', start_at: daysAgo(1), status: 'cancelled' }, // exclu : annulé
      { patient_id: 'p4', start_at: daysAgo(200), status: 'completed' }, // exclu : hors fenêtre de 90 jours
    ]
    const result = busiestWeekdays(appts, NOW, 90)
    expect(result).toHaveLength(7)
    const dayAgo1 = parisDayOfWeek(parisDateKey(new Date(daysAgo(1))))
    expect(result.find(d => d.dayOfWeek === dayAgo1)?.count).toBe(2)
    expect(result.reduce((s, d) => s + d.count, 0)).toBe(2)
  })
})

describe('appointmentsByHour', () => {
  it('ne liste que les heures ayant eu au moins un RDV, triées par heure', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'p1', start_at: '2026-07-20T08:00:00Z', status: 'completed' }, // 10h à Paris (été)
      { patient_id: 'p2', start_at: '2026-07-20T08:30:00Z', status: 'completed' }, // 10h à Paris aussi
      { patient_id: 'p3', start_at: '2026-07-21T06:00:00Z', status: 'completed' }, // 8h à Paris
      { patient_id: 'p4', start_at: '2026-07-20T08:00:00Z', status: 'cancelled' }, // exclu
    ]
    const result = appointmentsByHour(appts, NOW, 90)
    expect(result).toEqual([{ hour: 8, count: 1 }, { hour: 10, count: 2 }])
  })

  it('renvoie une liste vide sans aucun RDV', () => {
    expect(appointmentsByHour([], NOW, 90)).toEqual([])
  })
})

describe('newVsReturningPatients', () => {
  it('distingue un patient déjà vu avant ce mois d\'un patient réellement nouveau', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'returning', start_at: '2026-06-01T10:00:00Z', status: 'completed' },
      { patient_id: 'returning', start_at: '2026-07-10T10:00:00Z', status: 'completed' },
      { patient_id: 'new', start_at: '2026-07-12T10:00:00Z', status: 'completed' },
      { patient_id: 'cancelled-only', start_at: '2026-07-13T10:00:00Z', status: 'cancelled' },
    ]
    expect(newVsReturningPatients(appts, NOW)).toEqual({ new: 1, returning: 1 })
  })

  it('renvoie des compteurs à 0 sans RDV terminé ce mois-ci', () => {
    expect(newVsReturningPatients([], NOW)).toEqual({ new: 0, returning: 0 })
  })
})

describe('topReasons', () => {
  it('ne garde que le motif choisi, pas les détails libres après " — "', () => {
    const appts = [
      { reason: 'Vaccin — mon chat tousse un peu' },
      { reason: 'Vaccin' },
      { reason: 'Consultation générale — contrôle de routine' },
      { reason: undefined },
    ]
    expect(topReasons(appts)).toEqual([
      { reason: 'Vaccin', count: 2 },
      { reason: 'Consultation générale', count: 1 },
    ])
  })

  it('limite au nombre demandé', () => {
    const appts = [{ reason: 'A' }, { reason: 'B' }, { reason: 'C' }]
    expect(topReasons(appts, 2)).toHaveLength(2)
  })
})

describe('speciesBreakdown', () => {
  it('compte les espèces hors RDV annulés, triées par fréquence', () => {
    const appts = [
      { status: 'completed', animals: [{ species: 'chat' }] },
      { status: 'completed', animals: [{ species: 'chien' }, { species: 'chat' }] },
      { status: 'cancelled', animals: [{ species: 'chien' }] },
    ]
    expect(speciesBreakdown(appts)).toEqual([{ species: 'chat', count: 2 }, { species: 'chien', count: 1 }])
  })
})

describe('averageBookingLeadTimeDays', () => {
  it('calcule le délai moyen entre réservation et rendez-vous', () => {
    const appts = [
      { start_at: '2026-07-10T10:00:00Z', created_at: '2026-07-05T10:00:00Z', status: 'completed' }, // 5 jours
      { start_at: '2026-07-10T10:00:00Z', created_at: '2026-07-09T10:00:00Z', status: 'confirmed' }, // 1 jour
    ]
    expect(averageBookingLeadTimeDays(appts)).toBe(3)
  })

  it('ignore les RDV annulés et les dates de réservation incohérentes', () => {
    const appts = [
      { start_at: '2026-07-10T10:00:00Z', created_at: '2026-07-05T10:00:00Z', status: 'cancelled' },
      { start_at: '2026-07-10T10:00:00Z', created_at: '2026-07-20T10:00:00Z', status: 'completed' }, // négatif, ignoré
    ]
    expect(averageBookingLeadTimeDays(appts)).toBeNull()
  })

  it('renvoie null sans aucune donnée', () => {
    expect(averageBookingLeadTimeDays([])).toBeNull()
  })
})

describe('lateCancellationRate', () => {
  it('distingue une annulation tardive (<24h) d\'une annulation à l\'avance', () => {
    const appts = [
      { status: 'cancelled', start_at: '2026-07-10T10:00:00Z', updated_at: '2026-07-10T02:00:00Z' }, // 8h avant : tardive
      { status: 'cancelled', start_at: '2026-07-10T10:00:00Z', updated_at: '2026-07-05T10:00:00Z' }, // 5 jours avant
    ]
    expect(lateCancellationRate(appts)).toBe(50)
  })

  it('renvoie null sans aucune annulation', () => {
    expect(lateCancellationRate([{ status: 'completed', start_at: daysAgo(1) }])).toBeNull()
  })
})

describe('presenceConfirmationRate', () => {
  it('calcule la part des RDV passés confirmés par le patient', () => {
    const appts = [
      { status: 'completed', start_at: daysAgo(1), confirmed_by_patient_at: daysAgo(2) },
      { status: 'no_show', start_at: daysAgo(1), confirmed_by_patient_at: undefined },
      { status: 'cancelled', start_at: daysAgo(1), confirmed_by_patient_at: undefined }, // exclu
      { status: 'confirmed', start_at: daysAhead(1), confirmed_by_patient_at: undefined }, // exclu : futur
    ]
    expect(presenceConfirmationRate(appts, NOW)).toBe(50)
  })

  it('renvoie null sans aucun RDV passé', () => {
    expect(presenceConfirmationRate([], NOW)).toBeNull()
  })
})

describe('computeReviewStats', () => {
  it('compare la note moyenne du mois courant à celle du mois précédent', () => {
    const reviews: ReviewForStats[] = [
      { rating: 5, created_at: '2026-07-05T10:00:00Z', doctor_reply: 'Merci !' },
      { rating: 3, created_at: '2026-07-10T10:00:00Z', doctor_reply: null },
      { rating: 4, created_at: '2026-06-10T10:00:00Z', doctor_reply: 'Merci' },
    ]
    const stats = computeReviewStats(reviews, NOW)
    expect(stats.averageRatingCurrentMonth).toBe(4)
    expect(stats.averageRatingPreviousMonth).toBe(4)
    expect(stats.reviewsCurrentMonth).toBe(2)
    expect(stats.responseRate).toBe(67)
  })

  it('renvoie des valeurs neutres sans aucun avis', () => {
    const stats = computeReviewStats([], NOW)
    expect(stats).toEqual({ averageRatingCurrentMonth: null, averageRatingPreviousMonth: null, reviewsCurrentMonth: 0, responseRate: null })
  })
})

describe('patientsToReengage', () => {
  it('ne retient qu\'un patient dont le dernier RDV terminé dépasse le seuil', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'ancien', start_at: daysAgo(200), status: 'completed' },
      { patient_id: 'recent', start_at: daysAgo(10), status: 'completed' },
      { patient_id: 'ancien-mais-revenu', start_at: daysAgo(200), status: 'completed' },
      { patient_id: 'ancien-mais-revenu', start_at: daysAgo(5), status: 'completed' },
    ]
    const result = patientsToReengage(appts, NOW, 180)
    expect(result).toHaveLength(1)
    expect(result[0].patientId).toBe('ancien')
    expect(result[0].monthsAgo).toBeGreaterThanOrEqual(6)
  })

  it('ignore un patient qui n\'a jamais eu de RDV terminé', () => {
    const appts: ExtendedStatsAppointment[] = [{ patient_id: 'p1', start_at: daysAgo(200), status: 'cancelled' }]
    expect(patientsToReengage(appts, NOW)).toEqual([])
  })
})

describe('patientReturnRate', () => {
  it('calcule la part de patients revenus au moins une fois', () => {
    const appts: ExtendedStatsAppointment[] = [
      { patient_id: 'fidele', start_at: daysAgo(100), status: 'completed' },
      { patient_id: 'fidele', start_at: daysAgo(10), status: 'completed' },
      { patient_id: 'ponctuel', start_at: daysAgo(20), status: 'completed' },
    ]
    expect(patientReturnRate(appts)).toBe(50)
  })

  it('renvoie null sans aucun RDV terminé', () => {
    expect(patientReturnRate([{ patient_id: 'p1', start_at: daysAgo(1), status: 'cancelled' }])).toBeNull()
  })
})
