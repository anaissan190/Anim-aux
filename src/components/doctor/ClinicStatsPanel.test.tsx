import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ClinicStatsPanel from './ClinicStatsPanel'

const NOW = new Date('2026-10-15T10:00:00Z')

const members = [
  { doctor_id: 'd1', doctors: { consultation_price: 50, profiles: { first_name: 'Léa', last_name: 'Martin' } } },
  { doctor_id: 'd2', doctors: { consultation_price: 80, profiles: { first_name: 'Karim', last_name: 'Ben' } } },
]
const appt = (doctor_id: string, start_at: string, status: string, patient_id = 'p1') =>
  ({ doctor_id, start_at, status, patient_id, patientProfile: { first_name: 'Paul', last_name: 'Durand' } } as any)
const appointments = [
  appt('d1', '2026-10-05T09:00:00Z', 'completed'),
  appt('d1', '2026-10-07T09:00:00Z', 'completed', 'p2'),
  appt('d2', '2026-10-06T09:00:00Z', 'completed'),
]
const reviews = [
  { doctor_id: 'd1', rating: 5, created_at: '2026-10-01T10:00:00Z' },
  { doctor_id: 'd2', rating: 3, created_at: '2026-10-02T10:00:00Z' },
]

const renderPanel = (over: Partial<Parameters<typeof ClinicStatsPanel>[0]> = {}) =>
  render(<ClinicStatsPanel members={members} appointments={appointments} availabilities={[]} reviews={reviews} now={NOW} {...over} />)

describe('ClinicStatsPanel', () => {
  it("compare les praticiens, chacun avec son tarif, et additionne le cabinet", () => {
    renderPanel()
    const table = screen.getByRole('table')
    const lea = within(table).getByRole('button', { name: 'Léa Martin' }).closest('tr')!
    const karim = within(table).getByRole('button', { name: 'Karim Ben' }).closest('tr')!
    const total = within(table).getByRole('button', { name: 'Tout le cabinet' }).closest('tr')!
    expect(within(lea).getAllByText('100 €').length).toBeGreaterThan(0) // 2 RDV × 50 €
    expect(within(karim).getAllByText('80 €').length).toBeGreaterThan(0) // 1 RDV × 80 €
    expect(within(total).getAllByText('180 €').length).toBeGreaterThan(0)
    expect(within(lea).getByText('5 ★ (1)')).toBeInTheDocument()
    expect(within(total).getByText('4 ★ (2)')).toBeInTheDocument()
  })

  it("affiche par défaut le détail de tout le cabinet, avec le contenu complet d'un praticien seul", () => {
    renderPanel()
    expect(screen.getByText('Détail : tout le cabinet')).toBeInTheDocument()
    // blocs de l'onglet Statistiques d'un praticien seul
    expect(screen.getByRole('heading', { name: 'Ce mois-ci' })).toBeInTheDocument()
    expect(screen.getByText('RDV terminés')).toBeInTheDocument()
    expect(screen.getAllByText('Revenu estimé').length).toBeGreaterThan(0)
  })

  it("permet de passer au détail d'un praticien, depuis le choix ou depuis le comparatif", () => {
    renderPanel()
    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: 'Karim Ben' }))
    expect(screen.getByText('Détail : Karim Ben')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Léa Martin' }))
    expect(screen.getByText('Détail : Léa Martin')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: 'Tout le cabinet' }))
    expect(screen.getByText('Détail : tout le cabinet')).toBeInTheDocument()
  })

  it("avec un seul praticien, pas de comparatif ni de choix : seulement le détail", () => {
    renderPanel({ members: [members[0]], appointments: appointments.filter(a => a.doctor_id === 'd1') })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ce mois-ci' })).toBeInTheDocument()
  })

  it("un cabinet sans rendez-vous ni avis s'affiche sans erreur", () => {
    renderPanel({ appointments: [], reviews: [] })
    const total = within(screen.getByRole('table')).getByRole('button', { name: 'Tout le cabinet' }).closest('tr')!
    expect(within(total).getAllByText('0 €').length).toBeGreaterThan(0)
    expect(within(total).getAllByText('—').length).toBeGreaterThan(0)
  })
})
