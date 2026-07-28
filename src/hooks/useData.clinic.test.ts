// src/hooks/useData.clinic.test.ts — cabinets, secrétariat, tarifs
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))
vi.mock('@/lib/geo', () => ({ geocodeAddress: vi.fn(() => Promise.resolve(null)) }))

import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geo'
import { useAuthStore } from '@/lib/authStore'
import {
  useMyClinic, useDoctorPublicClinic, useRemoveClinicMember, useClinicMembers,
  useInviteClinicSecretary, useClinicStaffList, useMyClinicStaffInfo, useClinicAgenda,
  useClinicPatients, useClinicAppointments, useCreateClinic, useJoinClinic,
  useClinicServices, useAddClinicService, useDeleteClinicService,
  useDoctorServices, useAddDoctorService, useDeleteDoctorService, useUpdateClinic,
} from './useData'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useMyClinic', () => {
  it('extrait l\'objet clinics de la jointure clinic_members', async () => {
    const clinic = { id: 'clinic-1', name: 'Cabinet du Parc' }
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: { clinics: clinic }, error: null }))
    const { result } = renderHook(() => useMyClinic('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(clinic)
  })

  it('renvoie null (pas une erreur) si le praticien n\'a pas de cabinet', async () => {
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: null, error: { message: 'no rows' } }))
    const { result } = renderHook(() => useMyClinic('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe('useDoctorPublicClinic', () => {
  it('renvoie le premier résultat de get_doctor_clinic', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ clinic_id: 'c1', clinic_name: 'Cabinet' }], error: null } as any)
    const { result } = renderHook(() => useDoctorPublicClinic('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.clinic_id).toBe('c1')
  })
})

describe('useRemoveClinicMember', () => {
  it('appelle remove_clinic_member avec l\'id du membre', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    const { result } = renderHook(() => useRemoveClinicMember(), { wrapper })
    await result.current.mutateAsync({ clinicMemberId: 'cm-1', clinicId: 'clinic-1' })
    expect(supabase.rpc).toHaveBeenCalledWith('remove_clinic_member', { p_clinic_member_id: 'cm-1' })
  })

  it('convertit l\'erreur RPC en Error JS classique', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'non autorisé' } } as any)
    const { result } = renderHook(() => useRemoveClinicMember(), { wrapper })
    await expect(result.current.mutateAsync({ clinicMemberId: 'cm-1', clinicId: 'clinic-1' })).rejects.toThrow('non autorisé')
  })
})

describe('useClinicMembers', () => {
  it('filtre par cabinet', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useClinicMembers('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('clinic_id', 'clinic-1')
  })
})

describe('useInviteClinicSecretary', () => {
  it('renvoie le résultat en cas de succès', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true, login: 'CAB1234' }, error: null } as any)
    const { result } = renderHook(() => useInviteClinicSecretary(), { wrapper })
    const data = await result.current.mutateAsync({ clinicId: 'clinic-1', email: 'sec@a.fr' })
    expect(data).toEqual({ ok: true, login: 'CAB1234' })
  })

  it('lève une erreur avec le message précis extrait de error.context (pas le message générique)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: () => Promise.resolve({ error: 'Email déjà utilisé' }) },
      },
    } as any)
    const { result } = renderHook(() => useInviteClinicSecretary(), { wrapper })
    await expect(result.current.mutateAsync({ clinicId: 'clinic-1', email: 'sec@a.fr' })).rejects.toThrow('Email déjà utilisé')
  })

  it('retombe sur le message générique si error.context ne peut pas être parsé', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'panne réseau', context: undefined },
    } as any)
    const { result } = renderHook(() => useInviteClinicSecretary(), { wrapper })
    await expect(result.current.mutateAsync({ clinicId: 'clinic-1', email: 'sec@a.fr' })).rejects.toThrow('panne réseau')
  })

  it('lève une erreur si data.ok est explicitement false (réponse 2xx mais échec métier)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: false, error: 'Cabinet introuvable' }, error: null } as any)
    const { result } = renderHook(() => useInviteClinicSecretary(), { wrapper })
    await expect(result.current.mutateAsync({ clinicId: 'clinic-1', email: 'sec@a.fr' })).rejects.toThrow('Cabinet introuvable')
  })
})

describe('useClinicStaffList', () => {
  it('appelle get_clinic_staff_list', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ user_id: 's1' }], error: null } as any)
    const { result } = renderHook(() => useClinicStaffList('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_clinic_staff_list', { p_clinic_id: 'clinic-1' })
  })
})

describe('useMyClinicStaffInfo', () => {
  it('n\'exécute pas la requête pour un rôle autre que secretary', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    renderHook(() => useMyClinicStaffInfo(), { wrapper })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('récupère les infos pour un compte secretary', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@a.fr', role: 'secretary', is_admin: false, created_at: '' } })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ clinic_id: 'c1' }], error: null } as any)
    const { result } = renderHook(() => useMyClinicStaffInfo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ clinic_id: 'c1' })
  })
})

describe('useClinicAgenda', () => {
  it('n\'exécute pas la requête sans une plage from/to complète', () => {
    renderHook(() => useClinicAgenda('clinic-1'), { wrapper })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('appelle get_clinic_agenda avec la plage donnée', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
    const from = new Date('2026-08-01')
    const to = new Date('2026-08-07')
    const { result } = renderHook(() => useClinicAgenda('clinic-1', from, to), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_clinic_agenda', {
      p_clinic_id: 'clinic-1', p_from: from.toISOString(), p_to: to.toISOString(),
    })
  })
})

describe('useClinicPatients', () => {
  it('appelle get_clinic_patients', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
    const { result } = renderHook(() => useClinicPatients('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_clinic_patients', { p_clinic_id: 'clinic-1' })
  })
})

describe('useClinicAppointments', () => {
  it('court-circuite sans requêter appointments si le cabinet n\'a aucun membre', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'clinic_members' ? createQueryBuilderMock({ data: [], error: null }) : createQueryBuilderMock({ data: [], error: null })
    )
    const { result } = renderHook(() => useClinicAppointments('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    expect(supabase.from).not.toHaveBeenCalledWith('appointments')
  })

  it('fusionne le profil du patient et aplatit les animaux pour chaque RDV du cabinet', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'clinic_members') return createQueryBuilderMock({ data: [{ doctor_id: 'doc-1' }], error: null })
      if (table === 'appointments') {
        return createQueryBuilderMock({
          data: [{ id: 'appt-1', patient_id: 'p1', appointment_animals: [{ animals: { id: 'a1', name: 'Rex' } }] }],
          error: null,
        })
      }
      if (table === 'profiles') return createQueryBuilderMock({ data: [{ user_id: 'p1', first_name: 'A', last_name: 'B' }], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })
    const { result } = renderHook(() => useClinicAppointments('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].patientProfile).toEqual({ user_id: 'p1', first_name: 'A', last_name: 'B' })
    expect(result.current.data?.[0].animals).toEqual([{ id: 'a1', name: 'Rex' }])
  })
})

describe('useCreateClinic', () => {
  it('crée le cabinet puis inscrit le praticien comme membre', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null } as any)
    const clinicsBuilder = createQueryBuilderMock({ data: { id: 'clinic-1' }, error: null })
    const membersBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      table === 'clinics' ? clinicsBuilder : membersBuilder
    )

    const { result } = renderHook(() => useCreateClinic(), { wrapper })
    const clinic = await result.current.mutateAsync({ name: 'Cabinet du Parc', doctorId: 'doc-1' })

    expect(clinicsBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cabinet du Parc', owner_id: 'owner-1' }))
    expect(membersBuilder.insert).toHaveBeenCalledWith({ clinic_id: 'clinic-1', doctor_id: 'doc-1' })
    expect(clinic).toEqual({ id: 'clinic-1' })
  })

  it('rejette si personne n\'est authentifié', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any)
    const { result } = renderHook(() => useCreateClinic(), { wrapper })
    await expect(result.current.mutateAsync({ name: 'Cabinet', doctorId: 'doc-1' })).rejects.toThrow('Non authentifié')
  })
})

describe('useJoinClinic', () => {
  it('met le code d\'invitation en majuscules avant l\'appel RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    const { result } = renderHook(() => useJoinClinic(), { wrapper })
    await result.current.mutateAsync({ inviteCode: 'ab12cd34', doctorId: 'doc-1' })
    expect(supabase.rpc).toHaveBeenCalledWith('join_clinic_by_code', { p_invite_code: 'AB12CD34', p_doctor_id: 'doc-1' })
  })
})

describe('useClinicServices / useDoctorServices', () => {
  it('useClinicServices filtre par cabinet', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useClinicServices('clinic-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('clinic_id', 'clinic-1')
  })

  it('useDoctorServices filtre par praticien ET clinic_id null (tarifs perso, pas de cabinet)', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDoctorServices('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('doctor_id', 'doc-1')
    expect(builder.is).toHaveBeenCalledWith('clinic_id', null)
  })
})

describe('useAddClinicService / useDeleteClinicService', () => {
  it('useAddClinicService appelle la RPC add_clinic_service', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    const { result } = renderHook(() => useAddClinicService(), { wrapper })
    await result.current.mutateAsync({ clinicId: 'clinic-1', name: 'Consultation', price: 50, duration: '30 min' })
    expect(supabase.rpc).toHaveBeenCalledWith('add_clinic_service', {
      p_clinic_id: 'clinic-1', p_name: 'Consultation', p_price: 50, p_duration: '30 min',
    })
  })

  it('useDeleteClinicService appelle la RPC delete_clinic_service', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    const { result } = renderHook(() => useDeleteClinicService(), { wrapper })
    await result.current.mutateAsync({ id: 'srv-1', clinicId: 'clinic-1' })
    expect(supabase.rpc).toHaveBeenCalledWith('delete_clinic_service', { p_service_id: 'srv-1' })
  })
})

describe('useAddDoctorService / useDeleteDoctorService', () => {
  it('useAddDoctorService insère avec clinic_id null', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useAddDoctorService(), { wrapper })
    await result.current.mutateAsync({ doctorId: 'doc-1', name: 'Consultation', price: 50, duration: '30 min' })
    expect(builder.insert).toHaveBeenCalledWith({ doctor_id: 'doc-1', clinic_id: null, name: 'Consultation', price: 50, duration: '30 min' })
  })

  it('useDeleteDoctorService supprime par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteDoctorService(), { wrapper })
    await result.current.mutateAsync({ id: 'srv-1', doctorId: 'doc-1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'srv-1')
  })
})

describe('useUpdateClinic', () => {
  it('géocode la nouvelle adresse et inclut lat/lng si trouvés', async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: 48.85, lng: 2.35 })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateClinic(), { wrapper })
    await result.current.mutateAsync({ id: 'clinic-1', name: 'Cabinet du Parc', address: '10 rue de Rivoli', city: 'Paris' })

    expect(geocodeAddress).toHaveBeenCalledWith('10 rue de Rivoli', 'Paris')
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ lat: 48.85, lng: 2.35 }))
  })

  it('n\'inclut pas lat/lng si le géocodage échoue', async () => {
    vi.mocked(geocodeAddress).mockResolvedValue(null)
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateClinic(), { wrapper })
    await result.current.mutateAsync({ id: 'clinic-1', name: 'Cabinet du Parc' })

    const updatePayload = builder.update.mock.calls[0][0]
    expect(updatePayload).not.toHaveProperty('lat')
    expect(updatePayload).not.toHaveProperty('lng')
  })
})
