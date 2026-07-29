import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DoctorCard from './DoctorCard'

function baseDoctor(overrides: Record<string, any> = {}): any {
  return {
    id: 'doc-1', specialty: 'Vétérinaire', average_rating: 4.5, review_count: 12,
    consultation_price: 50, city: 'Paris', is_verified: false, home_visit: false,
    profiles: { first_name: 'Jean', last_name: 'Dupont', avatar_url: null },
    ...overrides,
  }
}

function renderCard(props: any) {
  return render(<MemoryRouter><DoctorCard {...props} /></MemoryRouter>)
}

describe('DoctorCard', () => {
  it('affiche le nom complet à partir du profil', () => {
    renderCard({ doctor: baseDoctor() })
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
  })

  it('retombe sur "Praticien" si le profil est absent', () => {
    renderCard({ doctor: baseDoctor({ profiles: undefined }) })
    expect(screen.getByText('Praticien')).toBeInTheDocument()
  })

  it('affiche le badge "Vérifié" seulement si is_verified', () => {
    const { rerender } = renderCard({ doctor: baseDoctor({ is_verified: true }) })
    expect(screen.getByText(/Vérifié/)).toBeInTheDocument()
    rerender(<MemoryRouter><DoctorCard doctor={baseDoctor({ is_verified: false })} /></MemoryRouter>)
    expect(screen.queryByText(/Vérifié/)).not.toBeInTheDocument()
  })

  it('affiche la distance si fournie', () => {
    renderCard({ doctor: baseDoctor(), distanceKm: 3.456 })
    expect(screen.getByText(/3\.5 km/)).toBeInTheDocument()
  })

  it('n\'affiche pas de distance si non fournie', () => {
    renderCard({ doctor: baseDoctor() })
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
  })

  it('pointe vers la fiche du praticien', () => {
    renderCard({ doctor: baseDoctor() })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/doctor/doc-1')
  })

  it('affiche le prochain créneau disponible si fourni', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0)
    renderCard({ doctor: baseDoctor(), nextSlotAt: tomorrow.toISOString() })
    expect(screen.getByText(/Demain à 09:00/)).toBeInTheDocument()
  })

  it('n\'affiche rien sur la disponibilité si nextSlotAt est absent ou null', () => {
    renderCard({ doctor: baseDoctor(), nextSlotAt: null })
    expect(screen.queryByText(/🕐/)).not.toBeInTheDocument()
  })
})
