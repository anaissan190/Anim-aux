// src/hooks/useData.push.test.ts — notifications push navigateur
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import {
  usePushSubscriptionStatus, useEnablePushNotifications, useDisablePushNotifications,
} from './useData'

const FAKE_USER = { id: 'user-1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: FAKE_USER, profile: null, loading: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePushSubscriptionStatus', () => {
  it("renvoie supported=false si le navigateur ne gère ni service worker ni PushManager", async () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => usePushSubscriptionStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ supported: false, subscribed: false })
  })

  it('renvoie subscribed=true si un abonnement push existe déjà', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://push.example/1' }) } }) },
    })
    const { result } = renderHook(() => usePushSubscriptionStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ supported: true, subscribed: true })
  })

  it("renvoie subscribed=false si le navigateur gère le push mais qu'aucun abonnement n'existe", async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(null) } }) },
    })
    const { result } = renderHook(() => usePushSubscriptionStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ supported: true, subscribed: false })
  })
})

describe('useEnablePushNotifications', () => {
  it('lève une erreur si la permission est refusée, sans appeler Supabase', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn(() => Promise.resolve('denied')) })

    const { result } = renderHook(() => useEnablePushNotifications(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow('Permission refusée')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("s'abonne et enregistre l'abonnement dans push_subscriptions si la permission est accordée", async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn(() => Promise.resolve('granted')) })
    const subscribeMock = vi.fn(() => Promise.resolve({
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
    }))
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe: subscribeMock } }) },
    })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useEnablePushNotifications(), { wrapper })
    await result.current.mutateAsync()

    expect(subscribeMock).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', endpoint: 'https://push.example/1', p256dh: 'p256dh-value', auth: 'auth-value' },
      { onConflict: 'user_id,endpoint' }
    )
  })
})

describe('useDisablePushNotifications', () => {
  it("ne fait rien s'il n'y a aucun abonnement actif", async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(null) } }) },
    })
    const { result } = renderHook(() => useDisablePushNotifications(), { wrapper })
    await result.current.mutateAsync()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('supprime l\'abonnement côté Supabase puis se désabonne du navigateur', async () => {
    const unsubscribeMock = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://push.example/1', unsubscribe: unsubscribeMock }) },
        }),
      },
    })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useDisablePushNotifications(), { wrapper })
    await result.current.mutateAsync()

    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('endpoint', 'https://push.example/1')
    expect(unsubscribeMock).toHaveBeenCalled()
  })
})
