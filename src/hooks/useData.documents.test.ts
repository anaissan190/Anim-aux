// src/hooks/useData.documents.test.ts — documents animaux / patient-praticien
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import { useAnimalDocuments, useCreateAnimalDocument, usePatientDoctorDocuments, useDeleteAnimalDocument } from './useData'

const FAKE_PATIENT = { id: 'patient-1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useAnimalDocuments', () => {
  it('résout le nom du déposant via profiles (uploaded_by référence auth.users, pas embeddable)', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'animal_documents') {
        return createQueryBuilderMock({ data: [{ id: 'd1', uploaded_by: 'doc-1' }], error: null })
      }
      if (table === 'profiles') {
        return createQueryBuilderMock({ data: [{ user_id: 'doc-1', first_name: 'Jean', last_name: 'Dupont' }], error: null })
      }
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useAnimalDocuments('a1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].uploaderName).toBe('Jean Dupont')
  })

  it('retombe sur "Utilisateur" si le profil du déposant est introuvable', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'animal_documents') return createQueryBuilderMock({ data: [{ id: 'd1', uploaded_by: 'ghost' }], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => useAnimalDocuments('a1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].uploaderName).toBe('Utilisateur')
  })
})

describe('useCreateAnimalDocument', () => {
  it('envoie le fichier au storage puis enregistre la ligne avec l\'URL publique', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(docsBuilder)
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn/animals/x.pdf' } })),
    } as any)

    const file = new File(['contenu'], 'ordonnance.pdf', { type: 'application/pdf' })
    const { result } = renderHook(() => useCreateAnimalDocument(), { wrapper })
    await result.current.mutateAsync({ animal_id: 'a1', file, document_type: 'ordonnance' })

    expect(docsBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      animal_id: 'a1', uploaded_by: 'patient-1', file_url: 'https://cdn/animals/x.pdf',
      file_name: 'ordonnance.pdf', document_type: 'ordonnance',
    }))
  })

  it('utilise "autre" comme type de document par défaut', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(docsBuilder)
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn/x.pdf' } })),
    } as any)

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useCreateAnimalDocument(), { wrapper })
    await result.current.mutateAsync({ animal_id: 'a1', file })

    expect(docsBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ document_type: 'autre' }))
  })

  it('propage l\'erreur si l\'upload vers le storage échoue, sans jamais insérer la ligne', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const docsBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(docsBuilder)
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: null, error: { message: 'quota dépassé' } })),
      getPublicUrl: vi.fn(),
    } as any)

    const file = new File(['x'], 'x.pdf', { type: 'application/pdf' })
    const { result } = renderHook(() => useCreateAnimalDocument(), { wrapper })
    await expect(result.current.mutateAsync({ animal_id: 'a1', file })).rejects.toBeTruthy()
    expect(docsBuilder.insert).not.toHaveBeenCalled()
  })
})

describe('usePatientDoctorDocuments', () => {
  it('ne garde que les documents animaux déposés par quelqu\'un d\'autre que le propriétaire', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const animalDocs = [
      { id: 'd1', uploaded_by: 'doc-1', created_at: '2026-01-02', animals: { owner_id: 'patient-1' } }, // déposé par le praticien → gardé
      { id: 'd2', uploaded_by: 'patient-1', created_at: '2026-01-01', animals: { owner_id: 'patient-1' } }, // déposé par le patient lui-même → exclu
    ]
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'animal_documents') return createQueryBuilderMock({ data: animalDocs, error: null })
      if (table === 'appointment_documents') return createQueryBuilderMock({ data: [], error: null })
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => usePatientDoctorDocuments(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('d1')
    expect(result.current.data?.[0].source).toBe('animal')
  })

  it('fusionne documents animaux et pièces jointes de RDV, triés par date décroissante', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'animal_documents') {
        return createQueryBuilderMock({
          data: [{ id: 'd1', uploaded_by: 'doc-1', created_at: '2026-01-01', animals: { owner_id: 'patient-1' } }],
          error: null,
        })
      }
      if (table === 'appointment_documents') {
        return createQueryBuilderMock({ data: [{ id: 'd2', uploaded_by: 'patient-1', created_at: '2026-01-05' }], error: null })
      }
      return createQueryBuilderMock({ data: [], error: null })
    })

    const { result } = renderHook(() => usePatientDoctorDocuments(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((d: any) => d.id)).toEqual(['d2', 'd1']) // le plus récent d'abord
    expect(result.current.data?.[0].source).toBe('appointment')
  })
})

describe('useDeleteAnimalDocument', () => {
  it('supprime le document par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteAnimalDocument(), { wrapper })
    await result.current.mutateAsync({ id: 'd1', animal_id: 'a1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'd1')
  })
})
