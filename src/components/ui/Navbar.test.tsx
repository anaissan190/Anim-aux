import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  it('affiche les mêmes onglets directs que le praticien (Accueil, Mes animaux, Mes rendez-vous, Documents)', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient' }) })
    renderNavbar()
    expect(screen.getByText('Accueil').closest('a')).toHaveAttribute('href', '/dashboard/patient')
    expect(screen.getByText('Mes animaux').closest('a')).toHaveAttribute('href', '/animaux')
    expect(screen.getByText('Mes rendez-vous').closest('a')).toHaveAttribute('href', '/rendez-vous')
    expect(screen.getByText('Documents').closest('a')).toHaveAttribute('href', '/documents')
    // Pas d'onglet "Rappels" : ces infos sont déjà dans l'onglet Vaccins de
    // la fiche animal et dans "Mes rendez-vous" (retour d'Anaïs, 07/09/2026).
    expect(screen.queryByText('Rappels')).not.toBeInTheDocument()
    expect(screen.queryByText('Mes patients')).not.toBeInTheDocument()
  })

  it('surligne l\'onglet actif d\'après le chemin de l\'URL', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient' }) })
    renderNavbar('/animaux')
    const animauxLink = screen.getByText('Mes animaux').closest('a')
    expect(animauxLink?.className).toContain('bg-sage-500')
    const homeLink = screen.getByText('Accueil').closest('a')
    expect(homeLink?.className).not.toContain('bg-sage-500')
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
    expect(screen.getByText('RDV')).toBeInTheDocument()
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

describe('Navbar — praticien et offre gratuite', () => {
  // Le praticien est lu dans `doctors`, son offre via la RPC doctor_has_pro.
  function renderDoctorNavbar(hasPro: boolean) {
    useAuthStore.setState({ user: fakeUser({ role: 'doctor' }) })
    vi.mocked(supabase.rpc).mockImplementation(((name: string) =>
      Promise.resolve({ data: name === 'doctor_has_pro' ? hasPro : [], error: null })) as any)
    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === 'doctors'
        ? createQueryBuilderMock({ data: { id: 'doc-1', user_id: 'u1' }, error: null })
        : createQueryBuilderMock({ data: [], error: null })) as any)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/doctor']}><Navbar /></MemoryRouter>
      </QueryClientProvider>
    )
  }

  const lockOf = (label: string) => screen.getByText(label).closest('a')!.querySelector('[title="Réservé à l\'abonnement"]')

  it('met un cadenas sur Mes patients, Tarifs, RDV et Statistiques, pas sur Mon espace ni Avis', async () => {
    renderDoctorNavbar(false)
    await waitFor(() => expect(lockOf('Mes patients')).not.toBeNull())
    expect(lockOf('Tarifs')).not.toBeNull()
    expect(lockOf('RDV')).not.toBeNull()
    expect(lockOf('Statistiques')).not.toBeNull()
    expect(lockOf('Mon espace')).toBeNull()
    expect(lockOf('Avis')).toBeNull()
    // Les onglets restent cliquables : la page explique l'abonnement.
    expect(screen.getByText('Mes patients').closest('a')).toHaveAttribute('href', '/dashboard/doctor?tab=patients')
  })

  it("marque l'enveloppe des messages comme réservée à l'abonnement pour un praticien gratuit", async () => {
    renderDoctorNavbar(false)
    await waitFor(() => expect(screen.getByTitle("Messages (réservé à l'abonnement)")).toBeInTheDocument())
    // L'enveloppe reste cliquable : elle mène à la page qui explique l'abonnement.
    expect(screen.getByTitle("Messages (réservé à l'abonnement)")).toHaveAttribute('href', '/dashboard/doctor?tab=messages')
  })

  it('ne met aucun cadenas à un praticien abonné', async () => {
    renderDoctorNavbar(true)
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.some(c => c[0] === 'doctor_has_pro')).toBe(true))
    expect(lockOf('Mes patients')).toBeNull()
    expect(lockOf('Statistiques')).toBeNull()
    expect(screen.getByTitle('Messages')).toBeInTheDocument()
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

  it('masque les onglets propriétaire pour un compte is_admin', () => {
    useAuthStore.setState({ user: fakeUser({ role: 'patient', is_admin: true }) })
    renderNavbar()
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument()
    expect(screen.queryByText('Mes animaux')).not.toBeInTheDocument()
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
