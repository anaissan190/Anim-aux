// src/hooks/useData.notifications.test.ts — RDV patient, rappels, notifications
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import {
  usePatientAppointments, usePatientReminders, useAppointmentDocuments,
  useNotifications, useMarkNotificationsRead, useDeleteNotification, useDeleteAllNotifications,
  useMarkConversationRead,
} from './useData'

const FAKE_PATIENT = { id: 'patient-1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('usePatientAppointments', () => {
  it('n\'exécute pas la requête sans utilisateur connecté', () => {
    renderHook(() => usePatientAppointments(), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('filtre par le patient connecté', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => usePatientAppointments(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('patient_id', 'patient-1')
  })
})

describe('usePatientReminders', () => {
  it('associe chaque rappel de vaccin à son animal', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const animals = [{ id: 'a1', name: 'Rex', species: 'Chien' }]
    const vaccines = [{ id: 'v1', name: 'Rage', next_due_date: '2026-08-01', animal_id: 'a1' }]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: [], error: null })
      if (table === 'animals') return createQueryBuilderMock({ data: animals, error: null })
      if (table === 'vaccines') return createQueryBuilderMock({ data: vaccines, error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => usePatientReminders(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.vaccineReminders).toEqual([
      { ...vaccines[0], animal: animals[0] },
    ])
  })

  it('ne requête pas les vaccins si le patient n\'a aucun animal', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: [], error: null })
      if (table === 'animals') return createQueryBuilderMock({ data: [], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => usePatientReminders(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.vaccineReminders).toEqual([])
    expect(supabase.from).not.toHaveBeenCalledWith('vaccines')
  })
})

describe('useAppointmentDocuments', () => {
  it('n\'exécute pas la requête sans appointmentId', () => {
    renderHook(() => useAppointmentDocuments(undefined), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('renvoie [] plutôt que null si aucun document', async () => {
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: null, error: null }))
    const { result } = renderHook(() => useAppointmentDocuments('appt-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useNotifications', () => {
  it('limite à 20 notifications, triées par date décroissante', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.limit).toHaveBeenCalledWith(20)
  })
})

describe('useMarkNotificationsRead', () => {
  it('ne marque comme lues que les notifications du patient connecté', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })
    await result.current.mutateAsync()
    expect(builder.update).toHaveBeenCalledWith({ is_read: true })
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'patient-1')
  })
})

describe('useDeleteNotification', () => {
  it('supprime la notification par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteNotification(), { wrapper })
    await result.current.mutateAsync('notif-1')
    expect(builder.eq).toHaveBeenCalledWith('id', 'notif-1')
  })
})

describe('useDeleteAllNotifications', () => {
  it('supprime uniquement les notifications du patient connecté', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteAllNotifications(), { wrapper })
    await result.current.mutateAsync()
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'patient-1')
  })
})

describe('useMarkConversationRead', () => {
  it('ne marque comme lus que les messages non lus envoyés par cet interlocuteur', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useMarkConversationRead(), { wrapper })
    await result.current.mutateAsync('doc-1')
    expect(builder.eq).toHaveBeenCalledWith('receiver_id', 'patient-1')
    expect(builder.eq).toHaveBeenCalledWith('sender_id', 'doc-1')
    expect(builder.eq).toHaveBeenCalledWith('is_read', false)
  })
})
