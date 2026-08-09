import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '@/lib/authStore'

const mockNavigateComponent = vi.fn()
vi.mock('react-router-dom', () => ({
  Navigate: (props: any) => { mockNavigateComponent(props); return <div data-testid="navigate" data-to={props.to} /> },
  useLocation: () => ({ pathname: '/dashboard/patient', search: '' }),
}))

beforeEach(() => {
  mockNavigateComponent.mockClear()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

function baseUser(overrides: Record<string, any> = {}) {
  return { id: 'u1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '', ...overrides }
}

describe('ProtectedRoute', () => {
  it('redirige vers /login si personne n\'est connecté', () => {
    render(<ProtectedRoute><div>Contenu</div></ProtectedRoute>)
    // Le chemin d'origine est transmis en paramètre pour y revenir après
    // connexion — voir LoginPage.tsx.
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login?redirect=%2Fdashboard%2Fpatient')
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument()
  })

  it('affiche le contenu sans restriction de rôle si connecté', () => {
    useAuthStore.setState({ user: baseUser() })
    render(<ProtectedRoute><div>Contenu</div></ProtectedRoute>)
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })

  it('affiche le contenu si le rôle correspond', () => {
    useAuthStore.setState({ user: baseUser({ role: 'doctor' }) })
    render(<ProtectedRoute role="doctor"><div>Espace praticien</div></ProtectedRoute>)
    expect(screen.getByText('Espace praticien')).toBeInTheDocument()
  })

  it('redirige vers / si le rôle ne correspond pas', () => {
    useAuthStore.setState({ user: baseUser({ role: 'patient' }) })
    render(<ProtectedRoute role="doctor"><div>Espace praticien</div></ProtectedRoute>)
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })

  it('accepte un tableau de rôles', () => {
    useAuthStore.setState({ user: baseUser({ role: 'doctor' }) })
    render(<ProtectedRoute role={['patient', 'doctor']}><div>Contenu</div></ProtectedRoute>)
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })

  it('un compte is_admin contourne toute restriction de rôle', () => {
    useAuthStore.setState({ user: baseUser({ role: 'patient', is_admin: true }) })
    render(<ProtectedRoute role="doctor"><div>Espace praticien</div></ProtectedRoute>)
    expect(screen.getByText('Espace praticien')).toBeInTheDocument()
  })
})
