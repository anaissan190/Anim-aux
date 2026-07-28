// src/hooks/useData.appointments.test.ts — RDV côté praticien + création de RDV
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import { useDoctorAppointments, useCreateAppointment } from './useData'

const FAKE_PATIENT = { id: 'patient-1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useDoctorAppointments', () => {
  it('fusionne le profil du patient (via profiles, pas l\'embed users bloqué par RLS) et aplatit les animaux', async () => {
    const appts = [{
      id: 'appt-1', patient_id: 'patient-1', doctor_id: 'doc-1',
      appointment_animals: [{ animals: { id: 'a1', name: 'Rex' } }],
    }]
    const profiles = [{ user_id: 'patient-1', first_name: 'Anaïs', last_name: 'S' }]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: appts, error: null })
      if (table === 'profiles') return createQueryBuilderMock({ data: profiles, error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useDoctorAppointments('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].profiles).toEqual(profiles[0])
    expect(result.current.data?.[0].animals).toEqual([{ id: 'a1', name: 'Rex' }])
  })

  it('ne requête pas les profils s\'il n\'y a aucun rendez-vous', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: [], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useDoctorAppointments('doc-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.from).not.toHaveBeenCalledWith('profiles')
  })
})

describe('useCreateAppointment', () => {
  function mockTables(overrides: Record<string, any> = {}) {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return createQueryBuilderMock({ data: { id: 'appt-1' }, error: null, ...overrides.appointments })
      }
      return createQueryBuilderMock({ data: null, error: null, ...(overrides[table] ?? {}) })
    })
  }

  it('crée le RDV avec le statut confirmed et le patient connecté', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    mockTables()
    const appointmentsBuilder = createQueryBuilderMock({ data: { id: 'appt-1' }, error: null })
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'appointments' ? appointmentsBuilder : createQueryBuilderMock({ data: null, error: null })
    )

    const { result } = renderHook(() => useCreateAppointment(), { wrapper })
    const appt = await result.current.mutateAsync({
      doctor_id: 'doc-1', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T09:30:00Z',
    })

    expect(appointmentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ doctor_id: 'doc-1', patient_id: 'patient-1', status: 'confirmed' })
    )
    expect(appt).toEqual({ id: 'appt-1' })
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-appointment-confirmation', { body: { appointmentId: 'appt-1' } })
  })

  it('lie les animaux choisis via appointment_animals', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const animalsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: { id: 'appt-1' }, error: null })
      if (table === 'appointment_animals') return animalsBuilder
      return createQueryBuilderMock({ data: null, error: null })
    })

    const { result } = renderHook(() => useCreateAppointment(), { wrapper })
    await result.current.mutateAsync({
      doctor_id: 'doc-1', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T09:30:00Z',
      animal_ids: ['a1', 'a2'],
    })

    expect(animalsBuilder.insert).toHaveBeenCalledWith([
      { appointment_id: 'appt-1', animal_id: 'a1' },
      { appointment_id: 'appt-1', animal_id: 'a2' },
    ])
  })

  it('ne touche pas appointment_animals si aucun animal n\'est choisi', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'appointments' ? createQueryBuilderMock({ data: { id: 'appt-1' }, error: null }) : createQueryBuilderMock({ data: null, error: null })
    )

    const { result } = renderHook(() => useCreateAppointment(), { wrapper })
    await result.current.mutateAsync({ doctor_id: 'doc-1', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T09:30:00Z' })

    expect(supabase.from).not.toHaveBeenCalledWith('appointment_animals')
  })

  it('lie les documents déjà uploadés avec le déposant courant', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'appointments') return createQueryBuilderMock({ data: { id: 'appt-1' }, error: null })
      if (table === 'appointment_documents') return docsBuilder
      return createQueryBuilderMock({ data: null, error: null })
    })

    const { result } = renderHook(() => useCreateAppointment(), { wrapper })
    await result.current.mutateAsync({
      doctor_id: 'doc-1', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T09:30:00Z',
      documents: [{ file_name: 'ordo.pdf', file_url: 'https://x/ordo.pdf', file_type: 'application/pdf' }],
    })

    expect(docsBuilder.insert).toHaveBeenCalledWith([
      { appointment_id: 'appt-1', uploaded_by: 'patient-1', file_url: 'https://x/ordo.pdf', file_name: 'ordo.pdf', file_type: 'application/pdf' },
    ])
  })

  it('la réservation réussit même si l\'envoi de l\'email de confirmation échoue (best-effort)', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'appointments' ? createQueryBuilderMock({ data: { id: 'appt-1' }, error: null }) : createQueryBuilderMock({ data: null, error: null })
    )
    vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Edge Function indisponible'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useCreateAppointment(), { wrapper })
    const appt = await result.current.mutateAsync({ doctor_id: 'doc-1', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T09:30:00Z' })

    expect(appt).toEqual({ id: 'appt-1' })
  })

  it('propage l\'erreur si l\'insertion du RDV échoue', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilderMock({ data: null, error: { message: 'créneau déjà pris' } })
    )

    const { result } = renderHook(() => useCreateAppointment(), { wrapper })
    await expect(
      result.current.mutateAsync({ doctor_id: 'doc-1', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T09:30:00Z' })
    ).rejects.toBeTruthy()
  })
})
