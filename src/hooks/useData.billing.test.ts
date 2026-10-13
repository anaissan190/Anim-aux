// src/hooks/useData.billing.test.ts — paiement de l'abonnement (fonctions Edge Stripe)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import { useStartCheckout, useOpenBillingPortal, useMySubscriptions } from './useData'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

const DOCTOR = { id: 'u1', email: 'a@a.fr', role: 'doctor' as const, is_admin: false, created_at: '' }

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useStartCheckout', () => {
  it("appelle create-checkout-session avec l'offre et renvoie l'adresse de paiement", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true, url: 'https://checkout.stripe.com/c/pay/abc' }, error: null } as any)
    const { result } = renderHook(() => useStartCheckout(), { wrapper })

    const url = await result.current.mutateAsync({ plan: 'cabinet', clinicName: 'Cabinet du Parc', clinicCity: 'Paris' })

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-checkout-session', {
      body: { plan: 'cabinet', clinicName: 'Cabinet du Parc', clinicCity: 'Paris' },
    })
    expect(url).toBe('https://checkout.stripe.com/c/pay/abc')
  })

  it("traduit en français le code d'erreur renvoyé par la fonction (paiement pas encore configuré)", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: () => Promise.resolve({ ok: false, error: 'billing_not_configured' }) } },
    } as any)
    const { result } = renderHook(() => useStartCheckout(), { wrapper })
    await expect(result.current.mutateAsync({ plan: 'pro' })).rejects.toThrow(/pas encore ouvert/)
  })

  it("explique qu'il faut attendre la validation du dossier avant de payer", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: () => Promise.resolve({ ok: false, error: 'not_verified' }) } },
    } as any)
    const { result } = renderHook(() => useStartCheckout(), { wrapper })
    await expect(result.current.mutateAsync({ plan: 'pro' })).rejects.toThrow(/validé/)
  })

  it("retombe sur un message neutre si la réponse d'erreur est illisible ou si aucune adresse n'est renvoyée", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: { message: 'panne', context: undefined } } as any)
    const { result } = renderHook(() => useStartCheckout(), { wrapper })
    await expect(result.current.mutateAsync({ plan: 'pro' })).rejects.toThrow(/Une erreur est survenue/)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true }, error: null } as any)
    await expect(result.current.mutateAsync({ plan: 'pro' })).rejects.toThrow(/Une erreur est survenue/)
  })
})

describe('useOpenBillingPortal', () => {
  it('appelle create-portal-session et renvoie l\'adresse du portail', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true, url: 'https://billing.stripe.com/p/session/x' }, error: null } as any)
    const { result } = renderHook(() => useOpenBillingPortal(), { wrapper })
    const url = await result.current.mutateAsync()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-portal-session', { body: {} })
    expect(url).toBe('https://billing.stripe.com/p/session/x')
  })

  it("signale l'absence d'abonnement à gérer", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: () => Promise.resolve({ ok: false, error: 'no_customer' }) } },
    } as any)
    const { result } = renderHook(() => useOpenBillingPortal(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow(/Aucun abonnement/)
  })
})

describe('useMySubscriptions', () => {
  it("lit les abonnements du praticien connecté", async () => {
    useAuthStore.setState({ user: DOCTOR })
    const rows = [{ kind: 'doctor', status: 'active', current_period_end: '2026-12-01', cancel_at_period_end: false, created_at: '2026-10-13' }]
    const builder = createQueryBuilderMock({ data: rows, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useMySubscriptions(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.from).toHaveBeenCalledWith('subscriptions')
    expect(result.current.data).toEqual(rows)
  })

  it("ne lit rien pour un compte qui n'est pas un praticien", () => {
    useAuthStore.setState({ user: { ...DOCTOR, role: 'patient' } })
    const { result } = renderHook(() => useMySubscriptions(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
