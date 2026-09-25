import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import OnboardingTour from './OnboardingTour'

const USER = { id: 'u1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }
const PROFILE = { id: 'p1', user_id: 'u1', first_name: 'A', last_name: 'B', onboarding_completed_at: null, created_at: '', updated_at: '' }

// jsdom ne fait aucune mise en page : on simule des boutons visibles.
const realRect = Element.prototype.getBoundingClientRect
const realRects = Element.prototype.getClientRects

function addAnchors(keys: string[]) {
  keys.forEach((k, i) => {
    const el = document.createElement('button')
    el.setAttribute('data-tour', k)
    el.getBoundingClientRect = () => ({ left: 20 + i * 60, top: 20, width: 40, height: 40, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList
    el.scrollIntoView = () => {}
    document.body.appendChild(el)
  })
}

function renderTour(path = '/dashboard/patient') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}><OnboardingTour /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: USER, profile: PROFILE as any, loading: false })
})

afterEach(() => {
  document.querySelectorAll('[data-tour]').forEach(e => e.remove())
  Element.prototype.getBoundingClientRect = realRect
  Element.prototype.getClientRects = realRects
})

describe('OnboardingTour', () => {
  it('propose la visite à un nouveau patient, étape par étape, puis enregistre la fin', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    addAnchors(['notifications', 'messages', 'patient-tab:/animaux'])

    renderTour()

    expect(await screen.findByText('Vos notifications', {}, { timeout: 3000 })).toBeTruthy()
    fireEvent.click(screen.getByText('Suivant →'))
    expect(screen.getByText('Vos messages')).toBeTruthy()
    fireEvent.click(screen.getByText('← Précédent'))
    expect(screen.getByText('Vos notifications')).toBeTruthy()
    fireEvent.click(screen.getByText('Suivant →'))
    fireEvent.click(screen.getByText('Suivant →'))
    fireEvent.click(screen.getByText('Terminer'))

    await waitFor(() => expect(builder.update).toHaveBeenCalledWith({ onboarding_completed_at: expect.any(String) }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useAuthStore.getState().profile?.onboarding_completed_at).toEqual(expect.any(String))
  })

  it('la croix ferme la visite et la marque aussi comme vue', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    addAnchors(['notifications', 'messages'])

    renderTour()
    await screen.findByText('Vos notifications', {}, { timeout: 3000 })
    fireEvent.click(screen.getByLabelText('Fermer la visite'))

    await waitFor(() => expect(builder.update).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('saute les étapes dont le bouton n\'est pas visible', async () => {
    vi.mocked(supabase.from).mockReturnValue(createQueryBuilderMock({ data: null, error: null }))
    addAnchors(['notifications', 'patient-tab:/animaux']) // pas de "messages"

    renderTour()
    await screen.findByText('Vos notifications', {}, { timeout: 3000 })
    fireEvent.click(screen.getByText('Suivant →'))
    expect(screen.getByText('Mes animaux')).toBeTruthy()
  })

  it('ne s\'affiche pas si le tuto a déjà été vu', async () => {
    useAuthStore.setState({ profile: { ...PROFILE, onboarding_completed_at: '2026-09-01T00:00:00Z' } as any })
    addAnchors(['notifications', 'messages'])
    renderTour()
    await new Promise(r => setTimeout(r, 1300))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ne s\'affiche pas ailleurs que sur le tableau de bord du rôle', async () => {
    addAnchors(['notifications', 'messages'])
    renderTour('/animaux')
    await new Promise(r => setTimeout(r, 1300))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ne démarre pas (et ne marque rien comme vu) si aucun bouton n\'est visible', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)
    renderTour()
    await new Promise(r => setTimeout(r, 1300))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(builder.update).not.toHaveBeenCalled()
  })
})
