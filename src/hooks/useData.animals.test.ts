// src/hooks/useData.animals.test.ts — animaux, vaccins, poids, dossiers santé
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import {
  useSpecialties, useAnimals, useAnimal, useCreateAnimal, useUpdateAnimal, useDeleteAnimal,
  useVaccines, useCreateVaccine, useUpdateVaccine, useDeleteVaccine,
  useWeightTracking, useCreateWeight, useUpdateWeight, useDeleteWeight,
  useHealthRecords,
} from './useData'

const FAKE_PATIENT = { id: 'patient-1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('useSpecialties', () => {
  it('renvoie la liste des noms de spécialité (pas les objets complets)', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilderMock({ data: [{ name: 'Vétérinaire' }, { name: 'Toiletteur' }], error: null })
    )
    const { result } = renderHook(() => useSpecialties(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['Vétérinaire', 'Toiletteur'])
  })
})

describe('useAnimals', () => {
  it('filtre par le propriétaire connecté', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: [{ id: 'a1', name: 'Rex' }], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useAnimals(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'patient-1')
  })

  it('n\'exécute pas la requête sans utilisateur connecté', () => {
    renderHook(() => useAnimals(), { wrapper })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('useAnimal', () => {
  it('renvoie la fiche de l\'animal demandé', async () => {
    const animal = { id: 'a1', name: 'Rex', species: 'Chien' }
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: animal, error: null }))
    const { result } = renderHook(() => useAnimal('a1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(animal)
  })
})

describe('useCreateAnimal', () => {
  it('insère l\'animal avec le propriétaire connecté comme owner_id', async () => {
    useAuthStore.setState({ user: FAKE_PATIENT })
    const builder = createQueryBuilderMock({ data: { id: 'a1' }, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateAnimal(), { wrapper })
    await result.current.mutateAsync({ name: 'Rex', species: 'Chien' })
    expect(builder.insert).toHaveBeenCalledWith({ name: 'Rex', species: 'Chien', owner_id: 'patient-1' })
  })
})

describe('useUpdateAnimal', () => {
  it('met à jour uniquement les champs fournis, filtré par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useUpdateAnimal(), { wrapper })
    await result.current.mutateAsync({ id: 'a1', weight_kg: 12 })
    expect(builder.update).toHaveBeenCalledWith({ weight_kg: 12 })
    expect(builder.eq).toHaveBeenCalledWith('id', 'a1')
  })
})

describe('useDeleteAnimal', () => {
  it('supprime l\'animal par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteAnimal(), { wrapper })
    await result.current.mutateAsync('a1')
    expect(supabase.from).toHaveBeenCalledWith('animals')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'a1')
  })
})

describe('useVaccines', () => {
  it('filtre par animal_id, trié par date décroissante', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useVaccines('a1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('animal_id', 'a1')
    expect(builder.order).toHaveBeenCalledWith('date_administered', { ascending: false })
  })
})

describe('useCreateVaccine', () => {
  it('insère le vaccin tel quel', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateVaccine(), { wrapper })
    const vaccine = { animal_id: 'a1', name: 'Rage', date_administered: '2026-01-01' }
    await result.current.mutateAsync(vaccine)
    expect(builder.insert).toHaveBeenCalledWith(vaccine)
  })
})

describe('useUpdateVaccine', () => {
  it('sépare id/animal_id des champs à mettre à jour', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useUpdateVaccine(), { wrapper })
    await result.current.mutateAsync({ id: 'v1', animal_id: 'a1', name: 'Rage rappel' })
    expect(builder.update).toHaveBeenCalledWith({ name: 'Rage rappel' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'v1')
  })
})

describe('useDeleteVaccine', () => {
  it('supprime le vaccin par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteVaccine(), { wrapper })
    await result.current.mutateAsync({ id: 'v1', animal_id: 'a1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'v1')
  })
})

describe('useWeightTracking', () => {
  it('trie par date de mesure croissante (pour la courbe)', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useWeightTracking('a1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.order).toHaveBeenCalledWith('measured_at', { ascending: true })
  })
})

describe('useCreateWeight', () => {
  it('insère la mesure de poids', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useCreateWeight(), { wrapper })
    const entry = { animal_id: 'a1', weight_kg: 12, measured_at: '2026-01-01' }
    await result.current.mutateAsync(entry)
    expect(builder.insert).toHaveBeenCalledWith(entry)
  })
})

describe('useUpdateWeight', () => {
  it('sépare id/animal_id des champs à mettre à jour', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useUpdateWeight(), { wrapper })
    await result.current.mutateAsync({ id: 'w1', animal_id: 'a1', weight_kg: 13 })
    expect(builder.update).toHaveBeenCalledWith({ weight_kg: 13 })
  })
})

describe('useDeleteWeight', () => {
  it('supprime la mesure par id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useDeleteWeight(), { wrapper })
    await result.current.mutateAsync({ id: 'w1', animal_id: 'a1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'w1')
  })
})

describe('useHealthRecords', () => {
  it('filtre par animal_id, trié par date décroissante', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    const { result } = renderHook(() => useHealthRecords('a1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('animal_id', 'a1')
    expect(builder.order).toHaveBeenCalledWith('date', { ascending: false })
  })
})
