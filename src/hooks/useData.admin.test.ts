// src/hooks/useData.admin.test.ts — tableau de bord admin (20 hooks, tous RPC)
// Chaque hook ne fait qu'appeler une RPC SECURITY DEFINER précise — le seul
// risque réel de bug est une RPC ou des paramètres mal nommés, donc chaque
// test vérifie l'appel exact plutôt que de re-tester le pattern générique.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import {
  useAdminPendingDoctors, useAdminPendingDoctorsCount, useAdminReviewDoctor, useAdminPlatformStats,
  useAdminDoctorsByStatus, useAdminDoctorDetail, useAdminReviews, useAdminPatients, useAdminPatientDetail,
  useAdminClinics, useAdminClinicDetail, useAdminSecretaries, useAdminAppointments,
  useCreateReport, useAdminReports, useAdminResolveReport, useAdminDeleteReview,
  useAdminSuspendUser, useAdminUnsuspendUser, useAdminActionsLog,
} from './useData'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

async function expectQueryCallsRpc(useHook: () => any, rpcName: string, rpcArgs?: any) {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
  const { result } = renderHook(useHook, { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  if (rpcArgs !== undefined) expect(supabase.rpc).toHaveBeenCalledWith(rpcName, rpcArgs)
  else expect(supabase.rpc).toHaveBeenCalledWith(rpcName)
}

async function expectMutationCallsRpc(useHook: () => any, variables: any, rpcName: string, rpcArgs: any) {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
  const { result } = renderHook(useHook, { wrapper })
  await result.current.mutateAsync(variables)
  expect(supabase.rpc).toHaveBeenCalledWith(rpcName, rpcArgs)
}

describe('Requêtes admin (lecture)', () => {
  it('useAdminPendingDoctors → admin_list_pending_doctors', () =>
    expectQueryCallsRpc(() => useAdminPendingDoctors(), 'admin_list_pending_doctors'))

  it('useAdminPendingDoctorsCount → admin_pending_doctors_count, avec repli 0', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    const { result } = renderHook(() => useAdminPendingDoctorsCount(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(0)
  })

  it('useAdminPlatformStats → admin_platform_stats', () =>
    expectQueryCallsRpc(() => useAdminPlatformStats(), 'admin_platform_stats'))

  it('useAdminDoctorsByStatus → admin_list_doctors_by_status avec le statut demandé', () =>
    expectQueryCallsRpc(() => useAdminDoctorsByStatus('pending'), 'admin_list_doctors_by_status', { p_status: 'pending' }))

  it('useAdminDoctorDetail → admin_doctor_detail, désactivé sans id', () => {
    renderHook(() => useAdminDoctorDetail(null), { wrapper })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('useAdminDoctorDetail → admin_doctor_detail avec l\'id', () =>
    expectQueryCallsRpc(() => useAdminDoctorDetail('doc-1'), 'admin_doctor_detail', { p_doctor_id: 'doc-1' }))

  it('useAdminReviews → admin_list_reviews', () =>
    expectQueryCallsRpc(() => useAdminReviews(), 'admin_list_reviews'))

  it('useAdminPatients → admin_list_patients', () =>
    expectQueryCallsRpc(() => useAdminPatients(), 'admin_list_patients'))

  it('useAdminPatientDetail → admin_patient_detail avec l\'id', () =>
    expectQueryCallsRpc(() => useAdminPatientDetail('u1'), 'admin_patient_detail', { p_user_id: 'u1' }))

  it('useAdminClinics → admin_list_clinics', () =>
    expectQueryCallsRpc(() => useAdminClinics(), 'admin_list_clinics'))

  it('useAdminClinicDetail → admin_clinic_detail avec l\'id', () =>
    expectQueryCallsRpc(() => useAdminClinicDetail('clinic-1'), 'admin_clinic_detail', { p_clinic_id: 'clinic-1' }))

  it('useAdminSecretaries → admin_list_secretaries', () =>
    expectQueryCallsRpc(() => useAdminSecretaries(), 'admin_list_secretaries'))

  it('useAdminAppointments → admin_list_appointments', () =>
    expectQueryCallsRpc(() => useAdminAppointments(), 'admin_list_appointments'))

  it('useAdminReports → admin_list_reports', () =>
    expectQueryCallsRpc(() => useAdminReports(), 'admin_list_reports'))

  it('useAdminActionsLog → admin_list_actions_log', () =>
    expectQueryCallsRpc(() => useAdminActionsLog(), 'admin_list_actions_log'))
})

describe('Mutations admin (écriture)', () => {
  it('useAdminReviewDoctor → admin_review_doctor avec approve/reason', () =>
    expectMutationCallsRpc(
      () => useAdminReviewDoctor(), { doctorId: 'doc-1', approve: true, reason: undefined },
      'admin_review_doctor', { p_doctor_id: 'doc-1', p_approve: true, p_reason: null }
    ))

  it('useCreateReport → create_report avec le type/motif de signalement', () =>
    expectMutationCallsRpc(
      () => useCreateReport(), { targetType: 'review', targetId: 'r1', reason: 'Contenu injurieux' },
      'create_report', { p_target_type: 'review', p_target_id: 'r1', p_reason: 'Contenu injurieux' }
    ))

  it('useAdminResolveReport → admin_resolve_report avec statut/note', () =>
    expectMutationCallsRpc(
      () => useAdminResolveReport(), { reportId: 'rep-1', status: 'resolved', note: 'Vérifié' },
      'admin_resolve_report', { p_report_id: 'rep-1', p_status: 'resolved', p_note: 'Vérifié' }
    ))

  it('useAdminDeleteReview → admin_delete_review avec l\'id de l\'avis', () =>
    expectMutationCallsRpc(() => useAdminDeleteReview(), 'r1', 'admin_delete_review', { p_review_id: 'r1' }))

  it('useAdminSuspendUser → admin_suspend_user avec userId/reason', () =>
    expectMutationCallsRpc(
      () => useAdminSuspendUser(), { userId: 'u1', reason: 'Comportement abusif' },
      'admin_suspend_user', { p_user_id: 'u1', p_reason: 'Comportement abusif' }
    ))

  it('useAdminUnsuspendUser → admin_unsuspend_user avec userId', () =>
    expectMutationCallsRpc(() => useAdminUnsuspendUser(), 'u1', 'admin_unsuspend_user', { p_user_id: 'u1' }))

  it('useAdminReviewDoctor propage l\'erreur RPC (pas de conversion silencieuse)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'boom' } } as any)
    const { result } = renderHook(() => useAdminReviewDoctor(), { wrapper })
    await expect(result.current.mutateAsync({ doctorId: 'doc-1', approve: true })).rejects.toBeTruthy()
  })
})
