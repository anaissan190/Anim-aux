// src/hooks/useData.slots.test.ts — les deux derniers hooks : useAvailableSlots
// (déjà couvert indirectement par slots.test.ts + AvailabilityCalendar.test.tsx,
// testé ici directement pour la complétude) et useConversation.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import { useAvailableSlots, useConversation } from './useData'

const FAKE_PATIENT = { id: 'patient-1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useAvailableSlots', () => {
  it('n\'exécute aucune requête sans date choisie', () => {
    renderHook(() => useAvailableSlots('doc-1', null), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('renvoie [] directement si le praticien n\'a aucune disponibilité ce jour', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'availabilities' ? createQueryBuilderMock({ data: [], error: null }) : createQueryBuilderMock({ data: [], error: null })
    )
    const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 10)
    const { result } = renderHook(() => useAvailableSlots('doc-1', farFuture), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    // Court-circuite avant même d'appeler get_booked_slots / blocked_slots.
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('génère des créneaux à partir des disponibilités du jour demandé', async () => {
    const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 10)
    const dayOfWeek = farFuture.getDay()
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'availabilities') {
        return createQueryBuilderMock({
          data: [{ doctor_id: 'doc-1', day_of_week: dayOfWeek, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30, is_active: true }],
          error: null,
        })
      }
      if (table === 'blocked_slots') return createQueryBuilderMock({ data: [], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)

    const { result } = renderHook(() => useAvailableSlots('doc-1', farFuture), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2) // 09:00 et 09:30
  })
})

describe('useConversation', () => {
  it('n\'exécute pas la requête sans utilisateur ou sans interlocuteur', () => {
    renderHook(() => useConversation(''), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('récupère les messages échangés avec l\'interlocuteur donné', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: [{ id: 'm1', content: 'Bonjour' }], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useConversation('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.from).toHaveBeenCalledWith('messages')
    expect(builder.or).toHaveBeenCalledWith(
      'and(sender_id.eq.patient-1,receiver_id.eq.doc-1),and(sender_id.eq.doc-1,receiver_id.eq.patient-1)'
    )
    expect(result.current.data).toEqual([{ id: 'm1', content: 'Bonjour' }])
  })
})
