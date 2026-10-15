// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PLAN_OFFERS } from '@/lib/subscription'

vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/BackButton', () => ({ default: () => null }))

import LegalPage from './LegalPage'

function renderCgu() {
  // jsdom n'implémente pas scrollIntoView, que la page appelle à l'ouverture.
  Element.prototype.scrollIntoView = () => {}
  return render(<MemoryRouter initialEntries={['/cgu']}><LegalPage /></MemoryRouter>)
}

describe('CGU — abonnement des praticiens', () => {
  it("annonce les mêmes prix que l'écran d'abonnement (une seule source : PLAN_OFFERS)", () => {
    const { container } = renderCgu()
    const text = container.textContent ?? ''
    expect(text).toContain(`${PLAN_OFFERS.pro.priceHt} € hors taxes par mois`)
    expect(text).toContain(`${PLAN_OFFERS.cabinet.priceHt} € hors taxes par mois`)
  })

  it("couvre résiliation, défaut de paiement, absence de remboursement au prorata et rétractation", () => {
    renderCgu()
    expect(screen.getByText('7. Abonnement des praticiens')).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/résilier à tout moment/)
    expect(text).toMatch(/Aucune période commencée n'est remboursée au prorata/)
    expect(text).toMatch(/échec de paiement/)
    expect(text).toMatch(/droit de rétractation prévu pour les consommateurs ne s'applique pas/)
    expect(text).toMatch(/aucun paiement n'est demandé avant cette validation/)
  })

  it("prévoit une offre sur mesure au-delà de 5 praticiens, avec l'adresse de contact", () => {
    renderCgu()
    expect(document.body.textContent).toMatch(/Au-delà de 5 praticiens, une offre sur mesure est étudiée au cas par cas : il suffit d'écrire à contact@monanimeaux\.fr/)
  })

  it("numérote les articles des CGU sans trou ni doublon", () => {
    const { container } = renderCgu()
    const numbers = [...container.querySelectorAll('h2')]
      .map(h => /^(\d+)\. /.exec(h.textContent ?? '')?.[1])
      .filter(Boolean)
      .map(Number)
    // Les CGU (articles 1 à 11) puis la politique de confidentialité repartent de 1.
    const firstBlock = numbers.slice(0, numbers.indexOf(1, 1) === -1 ? numbers.length : numbers.indexOf(1, 1))
    expect(firstBlock).toEqual(Array.from({ length: firstBlock.length }, (_, i) => i + 1))
    expect(firstBlock.length).toBe(11)
  })

  it('la politique de confidentialité cite Stripe parmi les sous-traitants', () => {
    renderCgu()
    expect(document.body.textContent).toMatch(/Stripe \(paiement des abonnements des praticiens/)
  })
})
