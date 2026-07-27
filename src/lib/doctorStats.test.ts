import { describe, it, expect } from 'vitest'
import { computeDoctorStats, type DoctorStatsAppointment, type DoctorAvailabilityRule } from './doctorStats'

// Horloge de référence fixe pour des tests déterministes.
const NOW = new Date('2026-07-23T12:00:00Z')

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
      { day_of_week: NOW.getDay(), start_time: '09:00', end_time: '11:00', slot_duration_minutes: 30 },
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
      { day_of_week: NOW.getDay(), start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30 },
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
      { day_of_week: NOW.getDay(), start_time: '09:00', end_time: '09:30', slot_duration_minutes: 30 },
    ]
    const appts: DoctorStatsAppointment[] = Array.from({ length: 30 }, (_, i) => ({
      start_at: daysAgo(i + 1), status: 'confirmed' as const,
    }))
    const stats = computeDoctorStats(appts, availabilities, 100, NOW)
    expect(stats.fillRate).toBe(100)
  })

  it('utilise 30 minutes par défaut si slot_duration_minutes est absent', () => {
    const availabilities: DoctorAvailabilityRule[] = [
      { day_of_week: NOW.getDay(), start_time: '09:00', end_time: '10:00' },
    ]
    const stats = computeDoctorStats([], availabilities, 100, NOW)
    // Ne doit pas planter ni renvoyer Infinity/NaN malgré l'absence du champ.
    expect(stats.fillRate).toBe(0)
  })
})
