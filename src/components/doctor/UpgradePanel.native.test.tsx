// Dans l'application native (Capacitor) : aucun bouton ni texte d'achat (voir canSellSubscriptions).
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))

import UpgradePanel from './UpgradePanel'

function renderPanel(variant?: 'banner' | 'page') {
  return render(
    <MemoryRouter>
      <UpgradePanel title="Votre agenda" body="Avec l'abonnement, ils réservent en ligne." variant={variant} />
    </MemoryRouter>,
  )
}

describe('UpgradePanel dans l\'application native', () => {
  it("n'affiche pas le bandeau d'invitation à l'abonnement", () => {
    const { container } = renderPanel()
    expect(container).toBeEmptyDOMElement()
  })

  it("en version page : dit que la fonction n'est pas disponible, sans bouton ni lien vers l'abonnement", () => {
    renderPanel('page')
    expect(screen.getByText(/n'est pas disponible avec votre offre actuelle/)).toBeInTheDocument()
    expect(screen.queryByText(/abonnement/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /abonnement/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Retour à Mon espace/ })).toBeInTheDocument()
  })
})
