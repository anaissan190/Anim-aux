import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfileSummary from './ProfileSummary'

const base = {
  name: 'Léa Martin', specialties: ['Vétérinaire'], verification: 'verified' as const,
  planLabel: 'Abonnement cabinet', listed: true,
  completeness: { percent: 85, done: 6, total: 7, hint: 'Indiquez les espèces acceptées' },
}

describe('ProfileSummary', () => {
  it("résume le praticien : nom, métier, vérification, offre et visibilité", () => {
    render(<ProfileSummary {...base} />)
    expect(screen.getByText('Léa Martin')).toBeInTheDocument()
    expect(screen.getByText('Vétérinaire')).toBeInTheDocument()
    expect(screen.getByText('✓ Vérifié')).toBeInTheDocument()
    expect(screen.getByText('Abonnement cabinet')).toBeInTheDocument()
    expect(screen.getByText('Visible dans la recherche')).toBeInTheDocument()
  })

  it("affiche la jauge de complétion et la suggestion", () => {
    render(<ProfileSummary {...base} />)
    expect(screen.getByText('Profil complété à 85 %')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Profil complété' })).toHaveAttribute('aria-valuenow', '85')
    expect(screen.getByText('Indiquez les espèces acceptées')).toBeInTheDocument()
  })

  it("n'affiche pas de suggestion quand le profil est complet", () => {
    render(<ProfileSummary {...base} completeness={{ percent: 100, done: 7, total: 7, hint: null }} />)
    expect(screen.queryByText(/Indiquez|Ajoutez|Rédigez|Choisissez|Déposez/)).not.toBeInTheDocument()
  })

  it("signale une fiche masquée, un dossier en attente ou rejeté, et se tait tant que l'état est inconnu", () => {
    const { rerender } = render(<ProfileSummary {...base} listed={false} verification="pending" />)
    expect(screen.getByText('Masqué de la recherche')).toBeInTheDocument()
    expect(screen.getByText('Vérification en attente')).toBeInTheDocument()
    rerender(<ProfileSummary {...base} listed={undefined} verification="rejected" />)
    expect(screen.getByText('Profil rejeté')).toBeInTheDocument()
    expect(screen.queryByText(/dans la recherche/)).not.toBeInTheDocument()
    rerender(<ProfileSummary {...base} verification={null} />)
    expect(screen.queryByText(/Vérifié|en attente|rejeté/)).not.toBeInTheDocument()
  })

  it("prend l'initiale du nom quand il n'y a pas de photo, et la photo sinon", () => {
    const { container, rerender } = render(<ProfileSummary {...base} avatarUrl={null} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getAllByText('L').length).toBeGreaterThan(0)
    rerender(<ProfileSummary {...base} avatarUrl="https://x/p.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/p.jpg')
  })

  it("affiche l'email sous le nom, sans jauge ni offre, pour un propriétaire", () => {
    render(<ProfileSummary name="Camille Dupont" subtitle="camille@exemple.fr" specialties={['Propriétaire']} />)
    expect(screen.getByText('camille@exemple.fr')).toBeInTheDocument()
    expect(screen.getByText('Propriétaire')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Abonnement|Offre gratuite/)).not.toBeInTheDocument()
  })

  it("affiche la jauge d'un propriétaire quand elle est fournie", () => {
    render(<ProfileSummary name="Camille Dupont" specialties={['Propriétaire']}
      completeness={{ percent: 70, done: 3, total: 4, hint: "Ajoutez un contact d'urgence" }} />)
    expect(screen.getByText('Profil complété à 70 %')).toBeInTheDocument()
    expect(screen.getByText("Ajoutez un contact d'urgence")).toBeInTheDocument()
  })
})
