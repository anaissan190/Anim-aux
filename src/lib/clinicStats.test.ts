import { describe, it, expect } from 'vitest'
import {
  memberName, clinicPrices, filterByDoctor, reviewSummary, clinicStatsTable, clinicMonthlyTotals, unclosedPastCount, upcomingAppointments,
  type ClinicMemberForStats,
} from './clinicStats'
import { computeDoctorStats, computeMonthlyComparison, priceByDoctor, priceResolver } from './doctorStats'
import { buildAccountingCsv, buildAccountingRows } from './accountingExport'

// 15 octobre 2026, midi à Paris
const NOW = new Date('2026-10-15T10:00:00Z')

const members: ClinicMemberForStats[] = [
  { doctor_id: 'd1', doctors: { consultation_price: 50, profiles: { first_name: 'Léa', last_name: 'Martin' } } },
  { doctor_id: 'd2', doctors: { consultation_price: 80, profiles: { first_name: 'Karim', last_name: 'Ben' } } },
  { doctor_id: 'd3', doctors: { consultation_price: null, profiles: null } },
]

const appt = (doctor_id: string, start_at: string, status: any, patient_id = 'p1') => ({ doctor_id, start_at, status, patient_id })

const appointments = [
  appt('d1', '2026-10-05T09:00:00Z', 'completed'),
  appt('d1', '2026-10-07T09:00:00Z', 'completed', 'p2'),
  appt('d1', '2026-10-08T09:00:00Z', 'no_show', 'p3'),
  appt('d2', '2026-10-06T09:00:00Z', 'completed'),
  appt('d2', '2026-10-09T09:00:00Z', 'cancelled', 'p2'),
  appt('d3', '2026-10-10T09:00:00Z', 'completed'),
  appt('d1', '2026-09-20T09:00:00Z', 'completed'), // mois précédent
]

describe('tarif par rendez-vous (priceResolver / priceByDoctor)', () => {
  it('un nombre se comporte comme avant : revenu = rendez-vous terminés × tarif', () => {
    const stats = computeDoctorStats(appointments.filter(a => a.doctor_id === 'd1'), [], 50, NOW)
    expect(stats.totalRevenue).toBe(150) // 3 terminés (dont septembre)
    expect(computeMonthlyComparison(appointments.filter(a => a.doctor_id === 'd1'), 50, NOW).current.revenue).toBe(100)
  })

  it("applique le tarif de chaque praticien quand on additionne tout le cabinet", () => {
    const price = priceByDoctor(clinicPrices(members))
    const stats = computeDoctorStats(appointments, [], price, NOW)
    // d1 : 3 × 50 ; d2 : 1 × 80 ; d3 : 1 × 0 (pas de tarif renseigné)
    expect(stats.totalRevenue).toBe(230)
    expect(computeMonthlyComparison(appointments, price, NOW).current.revenue).toBe(180) // d1 2×50 + d2 80 + d3 0
  })

  it("un praticien inconnu ou sans identifiant compte pour 0 €, jamais NaN", () => {
    const price = priceByDoctor({ d1: 50 })
    expect(priceResolver(price)({ doctor_id: 'zz' })).toBe(0)
    expect(priceResolver(price)({})).toBe(0)
    expect(priceResolver(NaN)({})).toBe(0)
  })
})

describe('export comptable avec un tarif par praticien', () => {
  it("met le bon montant sur chaque ligne et additionne le total", () => {
    const price = priceByDoctor(clinicPrices(members))
    const rows = buildAccountingRows(appointments as any, '2026-10', price)
    expect(rows.map(r => r[5])).toEqual(['50,00', '80,00', '50,00', '0,00']) // 5, 6, 7, 10 octobre
    const csv = buildAccountingCsv(appointments as any, '2026-10', price)
    expect(csv).toContain('TOTAL;;;;4 consultation(s);180,00')
  })
  it("un tarif unique donne le même résultat qu'avant", () => {
    const csv = buildAccountingCsv(appointments.filter(a => a.doctor_id === 'd1') as any, '2026-10', 50)
    expect(csv).toContain('TOTAL;;;;2 consultation(s);100,00')
  })
})

describe('helpers', () => {
  it('nomme un praticien, avec une valeur de repli', () => {
    expect(memberName(members[0])).toBe('Léa Martin')
    expect(memberName(members[2])).toBe('Praticien')
  })
  it('filtre par praticien, ou garde tout le cabinet', () => {
    expect(filterByDoctor(appointments, null)).toHaveLength(appointments.length)
    expect(filterByDoctor(appointments, 'd2')).toHaveLength(2)
    expect(filterByDoctor(appointments, 'inconnu')).toEqual([])
  })
  it("résume les avis : moyenne à une décimale, 0 sans avis", () => {
    expect(reviewSummary([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({ average: 4.3, count: 3 })
    expect(reviewSummary([])).toEqual({ average: 0, count: 0 })
  })
})

describe('clinicStatsTable', () => {
  const avail = [
    { doctor_id: 'd1', day_of_week: 1, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 },
    { doctor_id: 'd2', day_of_week: 2, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 },
  ]
  const reviews = [
    { doctor_id: 'd1', rating: 5, created_at: '2026-10-01T10:00:00Z' },
    { doctor_id: 'd1', rating: 4, created_at: '2026-10-02T10:00:00Z' },
    { doctor_id: 'd2', rating: 3, created_at: '2026-10-03T10:00:00Z' },
  ]
  const table = clinicStatsTable(members, appointments, avail, reviews, NOW)

  it('donne une ligne par praticien, dans l\'ordre du cabinet', () => {
    expect(table.rows.map(r => r.name)).toEqual(['Léa Martin', 'Karim Ben', 'Praticien'])
  })

  it('calcule le mois en cours et le revenu avec le tarif de chaque praticien', () => {
    const [lea, karim, third] = table.rows
    // absences et annulations : sur tous les rendez-vous passés (comme la fiche d'un praticien seul),
    // donc 1 absence sur 4 clôturés (3 terminés dont septembre + 1 absent) = 25 %
    expect(lea).toMatchObject({ completedThisMonth: 2, revenueThisMonth: 100, noShowRate: 25, rating: 4.5, reviewCount: 2 })
    expect(karim).toMatchObject({ completedThisMonth: 1, revenueThisMonth: 80, cancellationRate: 50, rating: 3, reviewCount: 1 })
    expect(third).toMatchObject({ completedThisMonth: 1, revenueThisMonth: 0, rating: null, reviewCount: 0 })
  })

  it("la ligne « Tout le cabinet » est la somme des praticiens", () => {
    expect(table.total).toMatchObject({ doctorId: null, name: 'Tout le cabinet', completedThisMonth: 4, revenueThisMonth: 180, reviewCount: 3 })
    expect(table.total.rating).toBe(4) // (5 + 4 + 3) / 3
    expect(table.total.revenueThisMonth).toBe(table.rows.reduce((t, r) => t + r.revenueThisMonth, 0))
  })

  it("un cabinet sans rendez-vous ni avis ne produit ni NaN ni erreur", () => {
    const empty = clinicStatsTable(members, [], [], [], NOW)
    expect(empty.total).toMatchObject({ completedThisMonth: 0, revenueThisMonth: 0, noShowRate: null, cancellationRate: null, fillRate: null, rating: null })
    expect(clinicStatsTable([], [], [], [], NOW).rows).toEqual([])
  })
})

describe('clinicMonthlyTotals', () => {
  it("donne le mois en cours et le précédent pour tout le cabinet, au tarif de chaque praticien", () => {
    const t = clinicMonthlyTotals(members, appointments, NOW)
    // octobre : d1 2 × 50 + d2 1 × 80 + d3 1 × 0 ; septembre : d1 1 × 50
    expect(t.current).toMatchObject({ completed: 4, revenue: 180 })
    expect(t.previous).toMatchObject({ completed: 1, revenue: 50 })
  })
  it("un cabinet sans rendez-vous donne des zéros", () => {
    expect(clinicMonthlyTotals(members, [], NOW).current).toMatchObject({ completed: 0, revenue: 0, noShowRate: null })
  })
})

describe('unclosedPastCount', () => {
  const list = [
    { start_at: '2026-10-01T09:00:00Z', status: 'confirmed' },
    { start_at: '2026-10-02T09:00:00Z', status: 'pending' },
    { start_at: '2026-10-03T09:00:00Z', status: 'completed' },
    { start_at: '2026-10-04T09:00:00Z', status: 'no_show' },
    { start_at: '2026-10-05T09:00:00Z', status: 'cancelled' },
    { start_at: '2026-10-20T09:00:00Z', status: 'confirmed' }, // à venir
  ]
  it("ne compte que les rendez-vous passés encore confirmés ou en attente", () => {
    expect(unclosedPastCount(list, NOW)).toBe(2)
  })
  it("renvoie 0 sans rendez-vous", () => {
    expect(unclosedPastCount([], NOW)).toBe(0)
  })
})

describe('upcomingAppointments', () => {
  const list = [
    { id: 'a3', start_at: '2026-10-22T09:00:00Z', status: 'confirmed', doctor_id: 'd2', animals: [{ name: 'Rex' }, { name: 'Mia' }], patientProfile: { first_name: 'Paul', last_name: 'Durand' } },
    { id: 'a1', start_at: '2026-10-16T09:00:00Z', status: 'pending', doctor_id: 'd1', reason: 'Vaccin — rappel annuel', animals: [], patientProfile: null },
    { id: 'a2', start_at: '2026-10-20T09:00:00Z', status: 'cancelled', doctor_id: 'd1' }, // annulé : exclu
    { id: 'a0', start_at: '2026-10-10T09:00:00Z', status: 'confirmed', doctor_id: 'd1' }, // passé : exclu
    { id: 'a4', start_at: '2026-10-25T09:00:00Z', status: 'completed', doctor_id: 'd1' }, // pas « à venir »
    { id: 'a5', start_at: '2026-10-30T09:00:00Z', status: 'confirmed', doctor_id: 'inconnu' },
  ]
  const result = upcomingAppointments(list as any, members, NOW)

  it("ne garde que les rendez-vous à venir, confirmés ou en attente, du plus proche au plus lointain", () => {
    expect(result.map(r => r.id)).toEqual(['a1', 'a3', 'a5'])
  })
  it("nomme le praticien, les animaux (sinon le motif) et le propriétaire", () => {
    expect(result[0]).toMatchObject({ doctorName: 'Léa Martin', label: 'Vaccin', patientName: '' })
    expect(result[1]).toMatchObject({ doctorName: 'Karim Ben', label: 'Rex, Mia', patientName: 'Paul Durand' })
  })
  it("un praticien inconnu s'appelle « Praticien », sans planter", () => {
    expect(result[2].doctorName).toBe('Praticien')
  })
  it("limite le nombre de lignes et accepte une liste vide", () => {
    expect(upcomingAppointments(list as any, members, NOW, 2)).toHaveLength(2)
    expect(upcomingAppointments([], members, NOW)).toEqual([])
  })
})
