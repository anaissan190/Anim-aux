import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const state = { launch: { phase: 'open', publicLaunchDate: null } as any, loading: false }
vi.mock('@/hooks/useData', () => ({ useLaunchSettings: () => ({ data: state.launch, isLoading: state.loading }) }))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/Footer', () => ({ default: () => null }))
vi.mock('@/components/search/SearchBar', () => ({ default: () => <div data-testid="search-bar" /> }))

import { useAuthStore } from '@/lib/authStore'
import LandingPage from './LandingPage'

const renderPage = () => render(<MemoryRouter><LandingPage /></MemoryRouter>)

beforeEach(() => {
  state.launch = { phase: 'open', publicLaunchDate: null }
  state.loading = false
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('LandingPage', () => {
  it('site ouvert : affiche la recherche pour les propriétaires', () => {
    renderPage()
    expect(screen.getAllByTestId('search-bar').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('prelaunch-landing')).not.toBeInTheDocument()
  })

  it("pré-lancement : un visiteur voit la page des praticiens, pas la recherche", () => {
    state.launch = { phase: 'prelaunch', publicLaunchDate: null }
    renderPage()
    expect(screen.getByTestId('prelaunch-landing')).toBeInTheDocument()
    expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument()
  })

  it("pré-lancement : un compte connecté garde l'accueil habituel", () => {
    state.launch = { phase: 'prelaunch', publicLaunchDate: null }
    useAuthStore.setState({ user: { id: 'u1', email: 'a@a.fr', role: 'patient', is_admin: true, created_at: '' } as any })
    renderPage()
    expect(screen.queryByTestId('prelaunch-landing')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('search-bar').length).toBeGreaterThan(0)
  })

  it("n'affiche ni la recherche ni la page praticiens tant que le réglage se charge", () => {
    state.loading = true
    state.launch = undefined
    renderPage()
    expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prelaunch-landing')).not.toBeInTheDocument()
  })
})
