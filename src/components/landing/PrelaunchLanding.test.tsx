import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/Footer', () => ({ default: () => null }))

import PrelaunchLanding from './PrelaunchLanding'

function renderLanding(date: string | null) {
  return render(<MemoryRouter><PrelaunchLanding launchDate={date} /></MemoryRouter>)
}

describe('PrelaunchLanding', () => {
  it("affiche la date d'ouverture réglée par l'admin", () => {
    renderLanding('2027-01-15')
    expect(screen.getByText(/Ouverture le 15 janvier/)).toBeInTheDocument()
  })

  it("reste neutre tant qu'aucune date n'est décidée", () => {
    renderLanding(null)
    expect(screen.getByText('Ouverture bientôt')).toBeInTheDocument()
    expect(screen.queryByText(/janvier/)).not.toBeInTheDocument()
  })

  it("mène à l'inscription praticien, sans paiement", () => {
    renderLanding(null)
    for (const link of screen.getAllByRole('link', { name: 'Je me pré-inscris' })) {
      expect(link).toHaveAttribute('href', '/register?role=doctor')
    }
    expect(screen.getByRole('link', { name: /J'ai déjà un compte/ })).toHaveAttribute('href', '/login')
  })

  it('présente les trois formules avec leur prix et la mention de TVA', () => {
    renderLanding(null)
    expect(screen.getByText('Gratuite')).toBeInTheDocument()
    expect(screen.getByText(/39,90 €/)).toBeInTheDocument()
    expect(screen.getByText(/95,90 €/)).toBeInTheDocument()
    expect(screen.getByText(/TVA non applicable, art\. 293 B du CGI/)).toBeInTheDocument()
  })
})
