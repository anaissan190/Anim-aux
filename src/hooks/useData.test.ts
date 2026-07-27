// src/hooks/useData.test.ts
// Premiers tests sur la couche hooks (useData.ts), jusqu'ici non couverte
// car chaque hook appelle directement le client Supabase. On mocke ce
// client (src/test/supabaseMock.ts) plutôt que de taper un vrai réseau —
// voir la remarque "hors périmètre pour l'instant" dans le cahier des
// charges, désormais entamée.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import { useAvailabilities, useMyWaitlistEntry, useJoinWaitlist, useConversationPartners } from './useData'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useAvailabilities', () => {
  it('renvoie les disponibilités renvoyées par Supabase', async () => {
    const fakeAvailabilities = [
      { id: '1', doctor_id: 'doc-1', day_of_week: 1, start_time: '09:00', end_time: '18:00', slot_duration_minutes: 30 },
    ]
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilderMock({ data: fakeAvailabilities, error: null })
    )

    const { result } = renderHook(() => useAvailabilities('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(fakeAvailabilities)
    expect(supabase.from).toHaveBeenCalledWith('availabilities')
  })

  it('remonte l\'erreur si la requête échoue', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    )

    const { result } = renderHook(() => useAvailabilities('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useMyWaitlistEntry', () => {
  it('n\'exécute pas la requête sans utilisateur connecté', () => {
    const { result } = renderHook(() => useMyWaitlistEntry('doc-1'), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('renvoie l\'entrée de liste d\'attente du patient connecté', async () => {
    useAuthStore.setState({ user: { id: 'patient-1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilderMock({ data: { id: 'entry-1' }, error: null })
    )

    const { result } = renderHook(() => useMyWaitlistEntry('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 'entry-1' })
  })
})

describe('useJoinWaitlist', () => {
  it('insère une entrée avec le bon patient_id et doctor_id', async () => {
    useAuthStore.setState({ user: { id: 'patient-1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useJoinWaitlist(), { wrapper })
    await result.current.mutateAsync('doc-1')

    expect(supabase.from).toHaveBeenCalledWith('waitlist_entries')
    expect(builder.insert).toHaveBeenCalledWith({ doctor_id: 'doc-1', patient_id: 'patient-1' })
  })

  it('propage l\'erreur si l\'insertion échoue', async () => {
    useAuthStore.setState({ user: { id: 'patient-1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilderMock({ data: null, error: { message: 'déjà inscrit' } })
    )

    const { result } = renderHook(() => useJoinWaitlist(), { wrapper })
    await expect(result.current.mutateAsync('doc-1')).rejects.toBeTruthy()
  })
})

describe('useConversationPartners', () => {
  it('appelle la RPC get_conversation_partners et renvoie son résultat', async () => {
    useAuthStore.setState({ user: { id: 'patient-1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    const partners = [{ user_id: 'doc-1', first_name: 'Jean', last_name: 'Dupont', avatar_url: null, last_message_at: '2026-01-01', last_message_content: 'Bonjour', unread_count: 1 }]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: partners, error: null } as any)

    const { result } = renderHook(() => useConversationPartners(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_conversation_partners')
    expect(result.current.data).toEqual(partners)
  })
})
