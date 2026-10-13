import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UpgradePanel from './UpgradePanel'

function renderPanel(props: Partial<React.ComponentProps<typeof UpgradePanel>> = {}) {
  return render(
    <MemoryRouter>
      <UpgradePanel title="Votre agenda" body="Vos patients réservent en ligne." {...props} />
    </MemoryRouter>,
  )
}

describe('UpgradePanel', () => {
  it("affiche le bandeau avec un bouton qui mène à l'écran de tarification (pas à un email)", () => {
    renderPanel()
    expect(screen.getByText('Votre agenda')).toBeInTheDocument()
    expect(screen.getByText('Vos patients réservent en ligne.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Passer à l'abonnement/ })
    expect(link).toHaveAttribute('href', '/abonnement')
  })

  it("en version page : cadenas, rappel que c'est une fonction de l'abonnement, bouton vers /abonnement et retour à Mon espace", () => {
    renderPanel({ variant: 'page' })
    expect(screen.getByText(/fait partie de l'abonnement/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Passer à l'abonnement/ })).toHaveAttribute('href', '/abonnement')
    expect(screen.getByRole('link', { name: /Retour à Mon espace/ })).toHaveAttribute('href', '/dashboard/doctor?tab=home')
  })
})
