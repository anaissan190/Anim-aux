import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import Navbar from './Navbar'

function renderNavbar(path = '/search') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
  vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: [], error: null }))
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}><Navbar /></MemoryRouter>
    </QueryClientProvider>
  )
}

function fakeUser(overrides: Record<string, any> = {}) {
  return { id: 'u1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '', ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('Navbar — déconnecté', () => {
  it('affiche Connexion / S\'inscrire, pas de cloche ni de menu', () => {
    renderNavbar()
    expect(screen.getByText('Connexion')).toBeInTheDocument()
    expect(screen.getByText("S'inscrire")).toBeInTheDocument()
    expect(screen.queryByTitle('Messages')).not.toBeInTheDocument()
  })
})

describe('Navbar — patient', () => {
  it('affiche "Mon espace" vers le dashboard patient, pas les onglets praticien', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient' }) })
    renderNavbar()
    const link = screen.getByText('Mon espace').closest('a')
    expect(link).toHaveAttribute('href', '/dashboard/patient')
    expect(screen.queryByText('Mes patients')).not.toBeInTheDocument()
  })

  it('le lien Messages pointe vers /messages (pas l\'onglet praticien)', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient' }) })
    renderNavbar()
    expect(screen.getByTitle('Messages')).toHaveAttribute('href', '/messages')
  })

  it('n\'affiche pas le lien Admin sans is_admin', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient', is_admin: false }) })
    renderNavbar()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })
})

describe('Navbar — praticien', () => {
  it('affiche les onglets du dashboard praticien, pas "Mon espace" patient', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'doctor' }) })
    renderNavbar('/dashboard/doctor')
    expect(screen.getByText('Mes patients')).toBeInTheDocument()
    expect(screen.getByText('Disponibilités')).toBeInTheDocument()
  })

  it('le lien Messages pointe vers l\'onglet dédié du dashboard praticien', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'doctor' }) })
    renderNavbar('/dashboard/doctor')
    expect(screen.getByTitle('Messages')).toHaveAttribute('href', '/dashboard/doctor?tab=messages')
  })

  it('surligne l\'onglet actif d\'après le paramètre ?tab= de l\'URL', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'doctor' }) })
    renderNavbar('/dashboard/doctor?tab=tarifs')
    const tarifsLink = screen.getByText('Tarifs').closest('a')
    expect(tarifsLink?.className).toContain('bg-sage-500')
    const homeLink = screen.getByText('Mon espace').closest('a')
    expect(homeLink?.className).not.toContain('bg-sage-500')
  })
})

describe('Navbar — secrétariat', () => {
  it('affiche uniquement le nom du cabinet et Déconnexion, sans cloche ni messages', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'secretary' }) })
    renderNavbar()
    expect(screen.getByText(/Espace secrétariat/)).toBeInTheDocument()
    expect(screen.queryByTitle('Messages')).not.toBeInTheDocument()
    expect(screen.getByText('Déconnexion')).toBeInTheDocument()
  })
})

describe('Navbar — admin', () => {
  it('affiche le lien Admin en plus de l\'espace habituel, quel que soit le rôle', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient', is_admin: true }) })
    renderNavbar()
    expect(screen.getByText('Admin').closest('a')).toHaveAttribute('href', '/dashboard/admin')
  })

  it('masque "Mon espace" propriétaire pour un compte is_admin', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient', is_admin: true }) })
    renderNavbar()
    expect(screen.queryByText('Mon espace')).not.toBeInTheDocument()
  })
})

describe('Navbar — déconnexion', () => {
  it('appelle signOut au clic sur Déconnexion', () => {
    const signOutMock = vi.fn(() => Promise.resolve())
    useAuthStore.setState({ user: fakeUser(), signOut: signOutMock })
    renderNavbar()
    fireEvent.click(screen.getAllByText('Déconnexion')[0])
    expect(signOutMock).toHaveBeenCalled()
  })
})
