// src/hooks/useData.availability.test.ts — disponibilités, congés, patients/agenda de cabinet
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import {
  useCreateAvailability, useDeleteAvailability, useBlockedSlots, useCreateBlockedSlot, useDeleteBlockedSlot,
  useDoctorPatientAnimals, useClinicAvailabilities, useClinicBlockedSlotsAll, useAnimalOwner, useDoctorReviews,
} from './useData'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCreateAvailability', () => {
  it('applique les valeurs par défaut (30 min, active) si non fournies', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateAvailability(), { wrapper })
    await result.current.mutateAsync({ doctor_id: 'doc-1', day_of_week: 1, start_time: '09:00', end_time: '18:00' })
    expect(builder.insert).toHaveBeenCalledWith({
      slot_duration_minutes: 30, is_active: true,
      doctor_id: 'doc-1', day_of_week: 1, start_time: '09:00', end_time: '18:00',
    })
  })

  it('permet de surcharger la durée de créneau par défaut', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateAvailability(), { wrapper })
    await result.current.mutateAsync({ doctor_id: 'doc-1', day_of_week: 1, start_time: '09:00', end_time: '18:00', slot_duration_minutes: 45 })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ slot_duration_minutes: 45 }))
  })
})

describe('useDeleteAvailability', () => {
  it('supprime par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteAvailability(), { wrapper })
    await result.current.mutateAsync({ id: 'av-1', doctorId: 'doc-1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'av-1')
  })
})

describe('useBlockedSlots', () => {
  it('filtre par praticien, trié par date de début', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useBlockedSlots('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('doctor_id', 'doc-1')
    expect(builder.order).toHaveBeenCalledWith('start_at')
  })
})

describe('useCreateBlockedSlot', () => {
  it('insère la période de congé telle quelle', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateBlockedSlot(), { wrapper })
    const slot = { doctor_id: 'doc-1', start_at: '2026-08-01', end_at: '2026-08-05', reason: 'Vacances' }
    await result.current.mutateAsync(slot)
    expect(builder.insert).toHaveBeenCalledWith(slot)
  })
})

describe('useDeleteBlockedSlot', () => {
  it('supprime par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteBlockedSlot(), { wrapper })
    await result.current.mutateAsync({ id: 'bs-1', doctorId: 'doc-1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'bs-1')
  })
})

describe('useDoctorPatientAnimals', () => {
  it('sans cabinet : cherche les patients du seul praticien donné', async () => {
    const appts = [{ patient_id: 'p1', doctor_id: 'doc-1' }]
    const profiles = [{ user_id: 'p1', first_name: 'Anaïs', last_name: 'S' }]
    const animals = [{ id: 'a1', name: 'Rex', owner_id: 'p1' }]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: appts, error: null })
      if (table === 'profiles') return createQueryBuilderMock({ data: profiles, error: null })
      if (table === 'animals') return createQueryBuilderMock({ data: animals, error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useDoctorPatientAnimals('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { id: 'a1', name: 'Rex', owner_id: 'p1', ownerName: 'Anaïs S', referentDoctorId: 'doc-1' },
    ])
    expect(supabase.from).not.toHaveBeenCalledWith('clinic_members')
  })

  it('avec cabinet : élargit aux patients de tous les membres', async () => {
    const members = [{ doctor_id: 'doc-1' }, { doctor_id: 'doc-2' }]
    const appts = [{ patient_id: 'p1', doctor_id: 'doc-2' }]
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'clinic_members') return createQueryBuilderMock({ data: members, error: null })
      if (table === 'appointments') return createQueryBuilderMock({ data: appts, error: null })
      if (table === 'profiles') return createQueryBuilderMock({ data: [{ user_id: 'p1', first_name: 'A', last_name: 'B' }], error: null })
      if (table === 'animals') return createQueryBuilderMock({ data: [{ id: 'a1', name: 'Rex', owner_id: 'p1' }], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useDoctorPatientAnimals('doc-1', 'clinic-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Le patient a été vu par doc-2 (un collègue), pas doc-1 lui-même.
    expect(result.current.data?.[0].referentDoctorId).toBe('doc-2')
  })

  it('retombe sur le praticien seul si le cabinet n\'a aucun membre trouvé', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'clinic_members') return createQueryBuilderMock({ data: [], error: null })
      if (table === 'appointments') return createQueryBuilderMock({ data: [], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useDoctorPatientAnimals('doc-1', 'clinic-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('n\'exécute pas la requête tant que clinicReady est faux', () => {
    renderHook(() => useDoctorPatientAnimals('doc-1', 'clinic-1', false), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('renvoie [] sans requêter animals/profiles si aucun rendez-vous', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: [], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useDoctorPatientAnimals('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    expect(supabase.from).not.toHaveBeenCalledWith('animals')
  })
})

describe('useClinicAvailabilities', () => {
  it('court-circuite sans requêter availabilities si le cabinet n\'a aucun membre', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'clinic_members' ? createQueryBuilderMock({ data: [], error: null }) : createQueryBuilderMock({ data: [], error: null })
    )
    const { result } = renderHook(() => useClinicAvailabilities('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    expect(supabase.from).not.toHaveBeenCalledWith('availabilities')
  })

  it('regroupe les disponibilités de tous les membres du cabinet', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'clinic_members') return createQueryBuilderMock({ data: [{ doctor_id: 'doc-1' }, { doctor_id: 'doc-2' }], error: null })
      if (table === 'availabilities') return createQueryBuilderMock({ data: [{ id: 'av-1' }], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })
    const { result } = renderHook(() => useClinicAvailabilities('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'av-1' }])
  })
})

describe('useClinicBlockedSlotsAll', () => {
  it('court-circuite sans requêter blocked_slots si le cabinet n\'a aucun membre', async () => {
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: [], error: null }))
    const { result } = renderHook(() => useClinicBlockedSlotsAll('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.from).not.toHaveBeenCalledWith('blocked_slots')
  })
})

describe('useAnimalOwner', () => {
  it('renvoie le profil du propriétaire demandé', async () => {
    const profile = { first_name: 'Anaïs', last_name: 'S', phone: '0600000000' }
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: profile, error: null }))
    const { result } = renderHook(() => useAnimalOwner('p1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(profile)
  })
})

describe('useDoctorReviews', () => {
  it('appelle get_doctor_reviews et restructure le profil de l\'auteur', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ id: 'r1', rating: 5, patient_first_name: 'Anaïs', patient_last_name: 'S', patient_avatar_url: null }],
      error: null,
    } as any)
    const { result } = renderHook(() => useDoctorReviews('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_doctor_reviews', { p_doctor_id: 'doc-1' })
    expect(result.current.data?.[0].profiles).toEqual({ first_name: 'Anaïs', last_name: 'S', avatar_url: null })
  })
})
