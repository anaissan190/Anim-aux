// src/hooks/useData.search.test.ts — recherche praticiens/cabinets
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useDoctors, useClinicsSearch, useClinicInfo, useClinicTeam, useDoctorsAvailabilities, useDoctor, useCurrentDoctor, useNextAvailableSlots } from './useData'
import { useAuthStore } from '@/lib/authStore'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

function makeDoctor(overrides: Record<string, any> = {}) {
  return {
    id: 'doc-1', specialty: 'Vétérinaire', verification_status: 'verified',
    average_rating: 4.5, consultation_price: 50, home_visit: false, accepted_species: ['Chiens'],
    profiles: { first_name: 'Jean', last_name: 'Dupont', avatar_url: null },
    ...overrides,
  }
}

describe('useDoctors', () => {
  it('renvoie les praticiens vérifiés sans filtre', async () => {
    const doctors = [makeDoctor()]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any) // get_clinic_member_doctor_ids
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: doctors, error: null }))

    const { result } = renderHook(() => useDoctors(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(doctors)
  })

  it('exclut les praticiens membres d\'un cabinet sans filtre de spécialité', async () => {
    const doctors = [makeDoctor({ id: 'doc-1' }), makeDoctor({ id: 'doc-2' })]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ doctor_id: 'doc-2' }], error: null } as any)
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: doctors, error: null }))

    const { result } = renderHook(() => useDoctors(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((d: any) => d.id)).toEqual(['doc-1'])
  })

  it('un praticien en cabinet reste trouvable par son nom même en recherche par spécialité', async () => {
    const doctors = [makeDoctor({ id: 'doc-2', specialty: 'Ostéopathe', profiles: { first_name: 'Marie', last_name: 'Curie', avatar_url: null } })]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ doctor_id: 'doc-2' }], error: null } as any)
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: doctors, error: null }))

    const { result } = renderHook(() => useDoctors({ specialty: 'marie' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('un membre de cabinet trouvé par sa spécialité (pas son nom) reste exclu', async () => {
    const doctors = [makeDoctor({ id: 'doc-2', specialty: 'Ostéopathe' })]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ doctor_id: 'doc-2' }], error: null } as any)
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: doctors, error: null }))

    const { result } = renderHook(() => useDoctors({ specialty: 'ostéopathe' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('ne lance aucune requête tant que enabled=false', () => {
    renderHook(() => useDoctors({}, false), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('useNextAvailableSlots', () => {
  it("renvoie null pour un praticien sans disponibilités actives", async () => {
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: [], error: null }))

    const { result } = renderHook(() => useNextAvailableSlots(['doc-1']), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ 'doc-1': null })
  })

  it('calcule un prochain créneau non nul à partir des disponibilités, RDV pris et congés', async () => {
    const dayOfWeek = new Date().getDay()
    vi.mocked(supabase.from).mockImplementation((table: any) => {
      if (table === 'availabilities') return createQueryBuilderMock({
        data: [{ day_of_week: dayOfWeek, start_time: '00:00', end_time: '23:59', slot_duration_minutes: 30 }],
        error: null,
      })
      return createQueryBuilderMock({ data: [], error: null }) // blocked_slots
    })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any) // get_booked_slots

    const { result } = renderHook(() => useNextAvailableSlots(['doc-1']), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.['doc-1']).not.toBeNull()
  })

  it("ne lance aucune requête pour une liste de praticiens vide", () => {
    renderHook(() => useNextAvailableSlots([]), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('useClinicsSearch', () => {
  it('appelle search_clinics avec les filtres ville/spécialité', async () => {
    const clinics = [{ id: 'clinic-1', name: 'Cabinet du Parc' }]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: clinics, error: null } as any)

    const { result } = renderHook(() => useClinicsSearch({ city: 'Paris' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('search_clinics', { p_city: 'Paris', p_specialty: null })
    expect(result.current.data).toEqual(clinics)
  })
})

describe('useClinicInfo', () => {
  it('renvoie le premier élément du tableau renvoyé par la RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ id: 'clinic-1', name: 'Cabinet du Parc' }], error: null } as any)

    const { result } = renderHook(() => useClinicInfo('clinic-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 'clinic-1', name: 'Cabinet du Parc' })
  })

  it('renvoie null si la RPC ne trouve rien', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)

    const { result } = renderHook(() => useClinicInfo('clinic-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('n\'exécute pas la requête sans clinicId', () => {
    renderHook(() => useClinicInfo(undefined), { wrapper })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('useClinicTeam', () => {
  it('appelle get_clinic_team avec l\'id du cabinet', async () => {
    const team = [{ doctor_id: 'doc-1' }]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: team, error: null } as any)

    const { result } = renderHook(() => useClinicTeam('clinic-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_clinic_team', { p_clinic_id: 'clinic-1' })
    expect(result.current.data).toEqual(team)
  })
})

describe('useDoctorsAvailabilities', () => {
  it('n\'exécute pas la requête pour une liste vide de praticiens', () => {
    renderHook(() => useDoctorsAvailabilities([]), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('filtre par la liste d\'ids donnée', async () => {
    const avail = [{ id: '1', doctor_id: 'doc-1' }]
    const builder = createQueryBuilderMock({ data: avail, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useDoctorsAvailabilities(['doc-1', 'doc-2']), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.in).toHaveBeenCalledWith('doctor_id', ['doc-1', 'doc-2'])
  })
})

describe('useDoctor', () => {
  it('renvoie la fiche du praticien demandé', async () => {
    const doctor = makeDoctor()
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: doctor, error: null }))

    const { result } = renderHook(() => useDoctor('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(doctor)
  })
})

describe('useCurrentDoctor', () => {
  it('n\'exécute pas la requête pour un patient (pas un praticien)', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    renderHook(() => useCurrentDoctor(), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('récupère la fiche du praticien connecté', async () => {
    useAuthStore.setState({ user: { id: 'doc-user-1', email: 'a@a.fr', role: 'doctor', is_admin: false, created_at: '' } })
    const doctor = makeDoctor()
    const builder = createQueryBuilderMock({ data: doctor, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useCurrentDoctor(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'doc-user-1')
  })
})
