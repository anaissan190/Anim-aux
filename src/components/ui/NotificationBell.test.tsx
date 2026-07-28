import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell from './NotificationBell'

const FAKE_USER = { id: 'u1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function renderBell(notifications: any[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: notifications, error: null }))
  return render(<QueryClientProvider client={queryClient}><NotificationBell /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: FAKE_USER, profile: null, loading: false })
})

function notif(overrides: Record<string, any> = {}) {
  return { id: 'n1', type: 'appointment_confirmed', title: 'RDV confirmé', body: 'Votre RDV a été confirmé', is_read: false, created_at: new Date().toISOString(), ...overrides }
}

describe('NotificationBell', () => {
  it('n\'affiche pas de pastille sans notification non lue', async () => {
    renderBell([notif({ is_read: true })])
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
  })

  it('affiche le nombre de notifications non lues (hors messages)', async () => {
    renderBell([notif({ id: 'n1', is_read: false }), notif({ id: 'n2', is_read: false })])
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
  })

  it('plafonne l\'affichage à "9+" au-delà de 9 non lues', async () => {
    const many = Array.from({ length: 12 }, (_, i) => notif({ id: `n${i}`, is_read: false }))
    renderBell(many)
    await waitFor(() => expect(screen.getByText('9+')).toBeInTheDocument())
  })

  it('exclut les notifications de type new_message du compteur (gérées par l\'icône enveloppe)', async () => {
    renderBell([notif({ id: 'n1', type: 'new_message', is_read: false })])
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
  })

  it('affiche "Aucune notification" quand la liste est vide, une fois ouverte', async () => {
    renderBell([])
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText('Aucune notification')).toBeInTheDocument()
  })

  it('liste les notifications (hors messages) une fois ouverte', async () => {
    renderBell([notif({ title: 'RDV confirmé' }), notif({ id: 'n2', type: 'new_message', title: 'Nouveau message' })])
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText('RDV confirmé')).toBeInTheDocument()
    expect(screen.queryByText('Nouveau message')).not.toBeInTheDocument()
  })

  it('marque tout comme lu à l\'ouverture s\'il y a des non-lues', async () => {
    const builder = createQueryBuilderMock({ data: [notif({ is_read: false })], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NotificationBell /></QueryClientProvider>)

    // Le badge ne reflète le compteur "non lues" qu'une fois la requête
    // useNotifications résolue — cliquer avant verrait unread=0 et ne
    // déclencherait jamais markRead.
    await screen.findByText('1')
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(builder.update).toHaveBeenCalledWith({ is_read: true }))
  })

  it('supprime une notification précise au clic sur ✕', async () => {
    const builder = createQueryBuilderMock({ data: [notif({ id: 'n1' })], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NotificationBell /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button'))
    await screen.findByTitle('Supprimer')
    fireEvent.click(screen.getByTitle('Supprimer'))

    await waitFor(() => expect(builder.eq).toHaveBeenCalledWith('id', 'n1'))
  })

  it('ne souscrit à aucun canal temps réel sans utilisateur connecté', () => {
    useAuthStore.setState({ user: null })
    renderBell([])
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('souscrit au canal notifications filtré par utilisateur connecté', () => {
    renderBell([])
    expect(supabase.channel).toHaveBeenCalledWith('notifications')
  })
})
