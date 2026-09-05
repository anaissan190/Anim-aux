// src/hooks/useData.calendarFeed.test.ts — flux calendrier abonnable (praticien)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import { useCalendarFeedToken, useRegenerateCalendarFeedToken } from './useData'

const FAKE_DOCTOR = { id: 'user-1', email: 'doc@a.fr', role: 'doctor' as const, is_admin: false, created_at: '' }
const FAKE_PATIENT = { id: 'user-2', email: 'pat@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCalendarFeedToken', () => {
  it('ne se déclenche pas pour un patient', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT, profile: null, loading: false })
    const { result } = renderHook(() => useCalendarFeedToken(), { wrapper })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('récupère le jeton via get_my_calendar_feed_token pour un praticien', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR, profile: null, loading: false })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'token-abc-123', error: null } as any)

    const { result } = renderHook(() => useCalendarFeedToken(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('get_my_calendar_feed_token')
    expect(result.current.data).toBe('token-abc-123')
  })

  it('propage une erreur RPC', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR, profile: null, loading: false })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'boom' } } as any)

    const { result } = renderHook(() => useCalendarFeedToken(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useRegenerateCalendarFeedToken', () => {
  it('appelle regenerate_my_calendar_feed_token et retourne le nouveau jeton', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR, profile: null, loading: false })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'token-new-456', error: null } as any)

    const { result } = renderHook(() => useRegenerateCalendarFeedToken(), { wrapper })
    const returned = await result.current.mutateAsync()

    expect(supabase.rpc).toHaveBeenCalledWith('regenerate_my_calendar_feed_token')
    expect(returned).toBe('token-new-456')
  })

  it('propage une erreur RPC', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR, profile: null, loading: false })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'boom' } } as any)

    const { result } = renderHook(() => useRegenerateCalendarFeedToken(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toBeTruthy()
  })
})
