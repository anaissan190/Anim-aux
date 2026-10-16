import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ClinicOverview, { ClinicHeader, deltaLabel } from './ClinicOverview'

const row = (name: string, completedThisMonth: number, doctorId = name) => ({
  doctorId, name, completedThisMonth, revenueThisMonth: 0, revenueLast30Days: 0,
  noShowRate: null, cancellationRate: null, fillRate: null, rating: null, reviewCount: 0,
})
const monthly = {
  current: { completed: 42, revenue: 2890, noShowRate: null, cancellationRate: null },
  previous: { completed: 38, revenue: 2680, noShowRate: null, cancellationRate: null },
}
const baseProps = {
  isAdmin: true, memberCount: 6, maxMembers: 8, seatsLeft: 2, inviteCode: 'AB7K9Q2M', calendarHref: '/dashboard/doctor?tab=disponibilites&view=shared',
  monthly, fillRate: 71, activity: [row('Léa Martin', 14), row('Karim Ben', 11), row('Sonia Dupuis', 8)],
  toReengage: 3, unclosed: 2, rating: { average: 4.6, count: 31 },
}
const renderOverview = (over = {}) => render(<MemoryRouter><ClinicOverview {...baseProps} {...over} /></MemoryRouter>)

describe('deltaLabel', () => {
  it("donne l'évolution en pourcentage, à la hausse comme à la baisse", () => {
    expect(deltaLabel(42, 38)).toEqual({ text: '+11 % vs mois précédent', good: true })
    expect(deltaLabel(30, 40)).toEqual({ text: '−25 % vs mois précédent', good: false })
  })
  it("donne l'écart brut quand le mois précédent est à zéro, et rien quand rien ne change", () => {
    expect(deltaLabel(4, 0)).toEqual({ text: '+4 vs mois précédent', good: true })
    expect(deltaLabel(0, 0)).toBeNull()
    expect(deltaLabel(5, 5)).toBeNull()
  })
})

describe('ClinicHeader', () => {
  it("affiche le nom, l'adresse et l'état de l'abonnement", () => {
    const { rerender } = render(<ClinicHeader name="Clinique des Lilas" city="Lyon" address="12 rue des Lilas" offerActive />)
    expect(screen.getByRole('heading', { name: 'Clinique des Lilas' })).toBeInTheDocument()
    expect(screen.getByText('12 rue des Lilas, Lyon')).toBeInTheDocument()
    expect(screen.getByText('✓ Abonnement cabinet')).toBeInTheDocument()
    rerender(<ClinicHeader name="Clinique des Lilas" offerActive={false} />)
    expect(screen.getByText('Cabinet non activé')).toBeInTheDocument()
    rerender(<ClinicHeader name="Clinique des Lilas" />)
    expect(screen.queryByText(/Abonnement cabinet|non activé/)).not.toBeInTheDocument()
  })
})

describe('ClinicOverview — créateur', () => {
  it("affiche les quatre indicateurs avec l'évolution", () => {
    renderOverview()
    expect(screen.getByText('Praticiens').closest('div')).toHaveTextContent('6 / 8')
    expect(screen.getByText('RDV terminés ce mois').closest('div')).toHaveTextContent('42')
    expect(screen.getByText('Revenu estimé').closest('div')).toHaveTextContent('2890 €')
    expect(screen.getAllByText(/vs mois précédent/).length).toBe(2)
    expect(screen.getByText('Remplissage 30 j').closest('div')).toHaveTextContent('71 %')
  })

  it("montre l'activité de l'équipe, le plus actif en premier", () => {
    renderOverview({ activity: [row('Sonia Dupuis', 8), row('Léa Martin', 14), row('Karim Ben', 11)] })
    const names = screen.getAllByRole('listitem').map(li => li.textContent).filter(t => /Martin|Ben|Dupuis/.test(t ?? ''))
    expect(names[0]).toContain('Léa Martin')
    expect(names[1]).toContain('Karim Ben')
    expect(names[2]).toContain('Sonia Dupuis')
  })

  it("regroupe les praticiens au-delà de six en « autres »", () => {
    const many = Array.from({ length: 8 }, (_, i) => row(`Praticien ${i + 1}`, 10 - i))
    renderOverview({ activity: many })
    expect(screen.getByText('2 autres')).toBeInTheDocument()
    expect(screen.queryByText('Praticien 8')).not.toBeInTheDocument()
  })

  it("liste ce qui demande une action, et se tait quand tout va bien", () => {
    const { rerender } = renderOverview()
    expect(screen.getByText(/3 patients à relancer/)).toBeInTheDocument()
    expect(screen.getByText(/2 RDV passés à clôturer/)).toBeInTheDocument()
    expect(screen.getByText(/Note moyenne 4,6 \(31 avis\)/)).toBeInTheDocument()
    rerender(<MemoryRouter><ClinicOverview {...baseProps} toReengage={0} unclosed={0} rating={null} /></MemoryRouter>)
    expect(screen.getByText(/Aucun patient à relancer/)).toBeInTheDocument()
    expect(screen.getByText(/Tous les RDV passés sont clôturés/)).toBeInTheDocument()
    expect(screen.getByText(/Pas encore d.avis/)).toBeInTheDocument()
  })

  it("renvoie vers les statistiques et l'équipe", () => {
    const onGoTo = vi.fn()
    renderOverview({ onGoTo })
    fireEvent.click(screen.getByRole('button', { name: 'Voir le détail' }))
    expect(onGoTo).toHaveBeenLastCalledWith('stats')
    fireEvent.click(screen.getByRole('button', { name: "Voir l'équipe" }))
    expect(onGoTo).toHaveBeenLastCalledWith('equipe')
    fireEvent.click(screen.getByRole('button', { name: /3 patients à relancer/ }))
    expect(onGoTo).toHaveBeenLastCalledWith('stats')
  })

  it("propose le calendrier du cabinet", () => {
    renderOverview()
    expect(screen.getByRole('link', { name: /calendrier du cabinet/ })).toHaveAttribute('href', baseProps.calendarHref)
  })
})

describe('ClinicOverview — invitation', () => {
  it("copie le code d'invitation et annonce les places restantes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderOverview()
    expect(screen.getByText('AB7K9Q2M')).toBeInTheDocument()
    expect(screen.getByText(/Il reste 2 places/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('AB7K9Q2M'))
    expect(await screen.findByRole('button', { name: 'Copié ✓' })).toBeInTheDocument()
  })

  it("dit quand le cabinet est complet ou qu'il reste une seule place", () => {
    const { rerender } = renderOverview({ seatsLeft: 0 })
    expect(screen.getByText(/Le cabinet est complet/)).toBeInTheDocument()
    rerender(<MemoryRouter><ClinicOverview {...baseProps} seatsLeft={1} /></MemoryRouter>)
    expect(screen.getByText(/Il reste 1 place\./)).toBeInTheDocument()
  })
})

describe('ClinicOverview — simple membre', () => {
  it("ne montre ni revenu ni activité des confrères : seulement la place, le code et le calendrier", () => {
    renderOverview({ isAdmin: false, monthly: null })
    expect(screen.getByText('Praticiens')).toBeInTheDocument()
    expect(screen.queryByText('Revenu estimé')).not.toBeInTheDocument()
    expect(screen.queryByText(/Activité de l/)).not.toBeInTheDocument()
    expect(screen.queryByText('À regarder')).not.toBeInTheDocument()
    expect(screen.getByText('AB7K9Q2M')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /calendrier du cabinet/ })).toBeInTheDocument()
  })
  it("même avec des chiffres fournis, un membre ne voit pas les indicateurs du créateur", () => {
    renderOverview({ isAdmin: false })
    expect(screen.queryByText('Revenu estimé')).not.toBeInTheDocument()
    expect(screen.queryByText(/Activité de l/)).not.toBeInTheDocument()
  })
})

describe('ClinicOverview — prochains rendez-vous et histogramme', () => {
  const upcoming = [
    { id: 'a1', startAt: '2026-10-16T12:30:00Z', doctorName: 'Léa Martin', label: 'Rex', patientName: 'Paul Durand' },
    { id: 'a2', startAt: '2026-10-17T08:00:00Z', doctorName: 'Karim Ben', label: '', patientName: '' },
  ]
  const months = [
    { monthKey: '2026-05', completed: 10, cancelled: 0, noShow: 0 },
    { monthKey: '2026-06', completed: 20, cancelled: 0, noShow: 0 },
    { monthKey: '2026-10', completed: 42, cancelled: 0, noShow: 0 },
  ]

  it("liste les prochains rendez-vous : date à l'heure de Paris, animal, propriétaire et praticien", () => {
    renderOverview({ upcoming })
    const card = screen.getByText('Prochains rendez-vous').closest('div')!
    expect(card).toHaveTextContent(/ven\. 16 oct\. · 14:30/i)
    expect(card).toHaveTextContent('Rex')
    expect(card).toHaveTextContent('Paul Durand')
    expect(card).toHaveTextContent('Léa Martin')
    // sans animal ni motif : un libellé neutre plutôt qu'une ligne vide
    expect(card).toHaveTextContent('Rendez-vous')
    expect(screen.getByRole('link', { name: 'Voir tous les rendez-vous' })).toHaveAttribute('href', baseProps.calendarHref)
  })

  it("dit quand il n'y a aucun rendez-vous à venir", () => {
    renderOverview({ upcoming: [] })
    expect(screen.getByText('Aucun rendez-vous à venir.')).toBeInTheDocument()
  })

  it("affiche l'histogramme des rendez-vous terminés, le mois courant mis en avant", () => {
    renderOverview({ months })
    expect(screen.getByText('Rendez-vous terminés sur 6 mois')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rendez-vous terminés par mois : 10, 20, 42' })).toBeInTheDocument()
    expect(screen.getByText('oct.')).toHaveClass('font-medium')
  })

  it("n'affiche pas d'histogramme sans données, ni ces cartes pour un simple membre", () => {
    const { rerender } = renderOverview({ months: [] })
    expect(screen.queryByText('Rendez-vous terminés sur 6 mois')).not.toBeInTheDocument()
    rerender(<MemoryRouter><ClinicOverview {...baseProps} isAdmin={false} monthly={null} upcoming={upcoming} months={months} /></MemoryRouter>)
    expect(screen.queryByText('Prochains rendez-vous')).not.toBeInTheDocument()
    expect(screen.queryByText('Rendez-vous terminés sur 6 mois')).not.toBeInTheDocument()
  })
})
