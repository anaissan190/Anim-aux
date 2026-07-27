import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BackButton from './BackButton'

const mockNavigate = vi.fn()
let mockLocationKey = 'default'

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: mockLocationKey }),
}))

beforeEach(() => {
  mockNavigate.mockClear()
  mockLocationKey = 'default'
})

describe('BackButton', () => {
  it('navigue vers le fallback si la page n\'a pas d\'historique (arrivée directe)', () => {
    render(<BackButton fallback="/search" />)
    fireEvent.click(screen.getByRole('button', { name: /retour/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/search')
  })

  it('revient dans l\'historique du navigateur si disponible', () => {
    mockLocationKey = 'abc123'
    render(<BackButton fallback="/search" />)
    fireEvent.click(screen.getByRole('button', { name: /retour/i }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
