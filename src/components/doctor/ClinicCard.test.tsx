import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ClinicCard from './ClinicCard'

function baseClinic(overrides: Record<string, any> = {}) {
  return {
    id: 'clinic-1', name: 'Cabinet du Parc', address: '10 rue de Rivoli', city: 'Paris',
    logo_url: null, member_count: 1, specialties: null, average_rating: null,
    ...overrides,
  }
}

function renderCard(props: any) {
  return render(<MemoryRouter><ClinicCard {...props} /></MemoryRouter>)
}

describe('ClinicCard', () => {
  it('accorde "praticien" au singulier pour un seul membre', () => {
    renderCard({ clinic: baseClinic({ member_count: 1 }) })
    expect(screen.getByText(/1 praticien\b/)).toBeInTheDocument()
    expect(screen.queryByText(/praticiens/)).not.toBeInTheDocument()
  })

  it('accorde "praticiens" au pluriel pour plusieurs membres', () => {
    renderCard({ clinic: baseClinic({ member_count: 3 }) })
    expect(screen.getByText(/3 praticiens/)).toBeInTheDocument()
  })

  it('n\'affiche la note que si average_rating est renseignée', () => {
    const { rerender } = renderCard({ clinic: baseClinic({ average_rating: null }) })
    expect(screen.queryByText(/⭐/)).not.toBeInTheDocument()
    rerender(<MemoryRouter><ClinicCard clinic={baseClinic({ average_rating: 4.2 })} /></MemoryRouter>)
    expect(screen.getByText(/4\.2/)).toBeInTheDocument()
  })

  it('affiche les spécialités si présentes', () => {
    renderCard({ clinic: baseClinic({ specialties: ['Vétérinaire', 'Toiletteur'] }) })
    expect(screen.getByText('Vétérinaire · Toiletteur')).toBeInTheDocument()
  })

  it('pointe vers la fiche du cabinet', () => {
    renderCard({ clinic: baseClinic() })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/cabinet/clinic-1')
  })
})
