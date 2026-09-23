import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import NotificationBell, { destinationForNotification } from './NotificationBell'

const FAKE_USER = { id: 'u1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function renderBell(notifications: any[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: notifications, error: null }))
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><NotificationBell /></MemoryRouter></QueryClientProvider>)
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
    render(<QueryClientProvider client={queryClient}><MemoryRouter><NotificationBell /></MemoryRouter></QueryClientProvider>)

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
    render(<QueryClientProvider client={queryClient}><MemoryRouter><NotificationBell /></MemoryRouter></QueryClientProvider>)

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
    // Nom de canal suffixé par l'id utilisateur + un aléa (voir
    // NotificationBell.tsx) : ce composant est monté deux fois en
    // parallèle (desktop/mobile), un nom fixe ferait échouer le second
    // abonnement Supabase.
    expect(supabase.channel).toHaveBeenCalledWith(expect.stringMatching(/^notifications-u1-/))
  })
})

describe('destinationForNotification', () => {
  it('envoie un patient vers "/rendez-vous" pour un RDV annulé/reporté/confirmé/rappelé', () => {
    for (const type of ['appointment_confirmed', 'appointment_cancelled', 'appointment_rescheduled', 'appointment_reminder']) {
      expect(destinationForNotification(type, null, false)).toBe('/rendez-vous')
    }
  })

  it('envoie un praticien vers l\'onglet RDV de son dashboard, pas "/rendez-vous" (route patient uniquement)', () => {
    // appointment_rescheduled est envoyé au praticien quand c'est le
    // patient qui déplace le RDV (migration 083_patient_reschedule.sql) —
    // avant ce correctif, le clic renvoyait vers "/rendez-vous", une route
    // ProtectedRoute réservée au rôle patient qui rejette un praticien.
    expect(destinationForNotification('appointment_rescheduled', null, true)).toBe('/dashboard/doctor?tab=disponibilites')
    expect(destinationForNotification('appointment_cancelled', null, true)).toBe('/dashboard/doctor?tab=disponibilites')
  })

  it('renvoie vers la fiche du praticien pour un rappel d\'avis ou une place de liste d\'attente libérée', () => {
    expect(destinationForNotification('review_reminder', 'doc1', false)).toBe('/doctor/doc1')
    expect(destinationForNotification('waitlist_slot_available', 'doc1', false)).toBe('/doctor/doc1')
  })

  it('renvoie vers la fiche santé de l\'animal pour un rappel de suivi (vaccin ou care_reminder)', () => {
    // vaccine_reminder : notifications en base avant la généralisation
    // vaccines -> care_items du 23/09/2026 (migration 100) ; care_reminder :
    // type utilisé pour tout nouveau rappel depuis cette date.
    expect(destinationForNotification('vaccine_reminder', 'animal1', false)).toBe('/animal/animal1')
    expect(destinationForNotification('care_reminder', 'animal1', false)).toBe('/animal/animal1')
  })

  it('renvoie vers le dashboard praticien pour une décision de vérification', () => {
    expect(destinationForNotification('doctor_verified', null, true)).toBe('/dashboard/doctor')
    expect(destinationForNotification('doctor_rejected', null, true)).toBe('/dashboard/doctor')
  })

  it('renvoie vers le dashboard admin au dépôt d\'un document praticien', () => {
    expect(destinationForNotification('doctor_document_submitted', null, false)).toBe('/dashboard/admin')
  })

  it('ne renvoie aucune destination sans related_id pour les types qui en dépendent', () => {
    expect(destinationForNotification('review_reminder', null, false)).toBeNull()
    expect(destinationForNotification('waitlist_slot_available', null, false)).toBeNull()
    expect(destinationForNotification('vaccine_reminder', null, false)).toBeNull()
    expect(destinationForNotification('care_reminder', null, false)).toBeNull()
  })

  it('ne renvoie aucune destination pour un type inconnu ou sans lien évident (ex. new_review, jamais réellement émis)', () => {
    expect(destinationForNotification('new_review', 'x', false)).toBeNull()
  })
})
