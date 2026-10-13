import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UpgradePanel from './UpgradePanel'

function renderPanel(props: Partial<React.ComponentProps<typeof UpgradePanel>> = {}) {
  return render(
    <MemoryRouter>
      <UpgradePanel title="Votre agenda" body="Vos patients réservent en ligne." doctorName="Gary Test" {...props} />
    </MemoryRouter>,
  )
}

describe('UpgradePanel', () => {
  it('affiche le bandeau avec un lien d\'abonnement qui ouvre un email pré-rempli', () => {
    renderPanel()
    expect(screen.getByText('Votre agenda')).toBeInTheDocument()
    expect(screen.getByText('Vos patients réservent en ligne.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Passer à l'abonnement/ })
    expect(link.getAttribute('href')).toMatch(/^mailto:contact\.animeaux@gmail\.com\?/)
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('Gary Test')
  })

  it('en version page : cadenas, rappel que c\'est une fonction de l\'abonnement et retour à Mon espace', () => {
    renderPanel({ variant: 'page' })
    expect(screen.getByText(/fait partie de l'abonnement/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Retour à Mon espace/ })).toHaveAttribute('href', '/dashboard/doctor?tab=home')
    expect(screen.getByRole('link', { name: /Passer à l'abonnement/ })).toBeInTheDocument()
  })
})
