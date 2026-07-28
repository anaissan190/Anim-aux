// src/hooks/useData.account.test.ts — dossiers santé, profil/compte, vérification praticien
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
  useCreateHealthRecord, useUpdateHealthRecord, useDeleteHealthRecord,
  useUpdateProfile, useUpdateDoctor, useDeleteAccount, useExportMyData,
  useDoctorVerificationDocuments, useUploadVerificationDocument, useDeleteVerificationDocument,
} from './useData'

const FAKE_DOCTOR_USER = { id: 'doc-user-1', email: 'a@a.fr', role: 'doctor' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useCreateHealthRecord / useUpdateHealthRecord / useDeleteHealthRecord', () => {
  it('useCreateHealthRecord insère le dossier tel quel', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateHealthRecord(), { wrapper })
    const record = { animal_id: 'a1', date: '2026-01-01', type: 'consultation', title: 'Bilan' }
    await result.current.mutateAsync(record)
    expect(builder.insert).toHaveBeenCalledWith(record)
  })

  it('useUpdateHealthRecord sépare id/animal_id des champs à mettre à jour', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useUpdateHealthRecord(), { wrapper })
    await result.current.mutateAsync({ id: 'hr-1', animal_id: 'a1', title: 'Bilan modifié' })
    expect(builder.update).toHaveBeenCalledWith({ title: 'Bilan modifié' })
  })

  it('useDeleteHealthRecord supprime par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteHealthRecord(), { wrapper })
    await result.current.mutateAsync({ id: 'hr-1', animal_id: 'a1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'hr-1')
  })
})

describe('useUpdateProfile', () => {
  it('rejette si le profil n\'est pas encore chargé', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR_USER, profile: null })
    const { result } = renderHook(() => useUpdateProfile(), { wrapper })
    await expect(result.current.mutateAsync({ first_name: 'Jean' })).rejects.toThrow('Profil non chargé')
  })

  it('met à jour le profil et synchronise le store local', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR_USER, profile: { id: 'p1', user_id: 'doc-user-1', first_name: 'Ancien', last_name: 'Nom' } as any })
    const updated = { id: 'p1', user_id: 'doc-user-1', first_name: 'Nouveau', last_name: 'Nom' }
    const builder = createQueryBuilderMock({ data: updated, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateProfile(), { wrapper })
    await result.current.mutateAsync({ first_name: 'Nouveau' })

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'doc-user-1')
    expect(useAuthStore.getState().profile).toEqual(updated)
  })
})

describe('useUpdateDoctor', () => {
  it('rejette si personne n\'est connecté', async () => {
    const { result } = renderHook(() => useUpdateDoctor(), { wrapper })
    await expect(result.current.mutateAsync({ bio: 'Nouvelle bio' })).rejects.toThrow('Utilisateur non connecté')
  })

  it('ne géocode PAS si ni ville ni adresse ne changent', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR_USER })
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: null, error: null }))
    const { result } = renderHook(() => useUpdateDoctor(), { wrapper })
    await result.current.mutateAsync({ bio: 'Nouvelle bio' })
    expect(geocodeAddress).not.toHaveBeenCalled()
  })

  it('géocode et inclut lat/lng si la ville change', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR_USER })
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: 45.75, lng: 4.85 })
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateDoctor(), { wrapper })
    await result.current.mutateAsync({ city: 'Lyon' })

    expect(geocodeAddress).toHaveBeenCalledWith(undefined, 'Lyon')
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ city: 'Lyon', lat: 45.75, lng: 4.85 }))
  })
})

describe('useDeleteAccount', () => {
  it('appelle la RPC delete_my_account', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    const { result } = renderHook(() => useDeleteAccount(), { wrapper })
    await result.current.mutateAsync()
    expect(supabase.rpc).toHaveBeenCalledWith('delete_my_account')
  })

  it('convertit l\'erreur RPC en Error JS', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'RDV en cours' } } as any)
    const { result } = renderHook(() => useDeleteAccount(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow('RDV en cours')
  })
})

describe('useExportMyData', () => {
  it('renvoie les données exportées par la RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { profile: {} }, error: null } as any)
    const { result } = renderHook(() => useExportMyData(), { wrapper })
    const data = await result.current.mutateAsync()
    expect(supabase.rpc).toHaveBeenCalledWith('export_my_data')
    expect(data).toEqual({ profile: {} })
  })
})

describe('useDoctorVerificationDocuments', () => {
  it('renvoie [] plutôt que null sans document', async () => {
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: null, error: null }))
    const { result } = renderHook(() => useDoctorVerificationDocuments('doc-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useUploadVerificationDocument', () => {
  it('envoie le fichier, génère une URL signée, puis enregistre la ligne', async () => {
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(docsBuilder)
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: vi.fn(),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed/diplome.pdf' }, error: null })),
    } as any)

    const file = new File(['x'], 'diplome.pdf', { type: 'application/pdf' })
    const { result } = renderHook(() => useUploadVerificationDocument(), { wrapper })
    await result.current.mutateAsync({ doctorId: 'doc-1', file, documentType: 'diplome' })

    expect(docsBuilder.insert).toHaveBeenCalledWith({
      doctor_id: 'doc-1', file_url: 'https://signed/diplome.pdf', file_name: 'diplome.pdf', document_type: 'diplome',
    })
  })

  it('utilise le chemin de stockage si l\'URL signée n\'a pas pu être générée', async () => {
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(docsBuilder)
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: vi.fn(),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })),
    } as any)

    const file = new File(['x'], 'diplome.pdf', { type: 'application/pdf' })
    const { result } = renderHook(() => useUploadVerificationDocument(), { wrapper })
    await result.current.mutateAsync({ doctorId: 'doc-1', file, documentType: 'diplome' })

    const payload = docsBuilder.insert.mock.calls[0][0]
    expect(payload.file_url).toMatch(/^doc-1\//)
  })

  it('propage l\'échec d\'upload sans jamais insérer la ligne', async () => {
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: null, error: { message: 'quota' } })),
      getPublicUrl: vi.fn(),
      createSignedUrl: vi.fn(),
    } as any)
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(docsBuilder)

    const file = new File(['x'], 'diplome.pdf', { type: 'application/pdf' })
    const { result } = renderHook(() => useUploadVerificationDocument(), { wrapper })
    await expect(result.current.mutateAsync({ doctorId: 'doc-1', file, documentType: 'diplome' })).rejects.toBeTruthy()
    expect(docsBuilder.insert).not.toHaveBeenCalled()
  })
})

describe('useDeleteVerificationDocument', () => {
  it('supprime par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteVerificationDocument(), { wrapper })
    await result.current.mutateAsync({ id: 'doc-1', doctorId: 'doc-1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'doc-1')
  })
})
