import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
}))

import { supabase } from '@/lib/supabase'
import SearchBar from './SearchBar'

function renderBar(props: any = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(supabase.from).mockReturnValue(
    createQueryBuilderMock({ data: [{ name: 'Vétérinaire' }, { name: 'Vétérinaire équin' }, { name: 'Toiletteur' }], error: null })
  )
  return render(<QueryClientProvider client={queryClient}><SearchBar {...props} /></QueryClientProvider>)
}

// La liste de suggestions est recalculée depuis specialtiesRef (rempli par
// un useEffect une fois useSpecialties() résolue) uniquement au moment de
// la frappe — taper avant que la requête initiale n'ait résolu calculerait
// les suggestions sur une liste encore vide. On laisse donc passer un tick
// réel avant toute interaction qui dépend des suggestions.
async function flushSpecialtiesQuery() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchBar', () => {
  it('navigue vers /search avec spécialité et ville au submit', () => {
    renderBar()
    fireEvent.change(screen.getByPlaceholderText('Spécialité, praticien...'), { target: { value: 'Vétérinaire' } })
    fireEvent.change(screen.getByPlaceholderText('Ville'), { target: { value: 'Paris' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
    const expectedUrl = '/search?' + new URLSearchParams({ specialty: 'Vétérinaire', city: 'Paris' }).toString()
    expect(mockNavigate).toHaveBeenCalledWith(expectedUrl)
  })

  it('suggère les spécialités correspondantes après 2 caractères', async () => {
    renderBar()
    await flushSpecialtiesQuery()
    fireEvent.change(screen.getByPlaceholderText('Spécialité, praticien...'), { target: { value: 'vé' } })
    expect(screen.getByText('Vétérinaire')).toBeInTheDocument()
    expect(screen.getByText('Vétérinaire équin')).toBeInTheDocument()
    expect(screen.queryByText('Toiletteur')).not.toBeInTheDocument()
  })

  it('ne montre aucune suggestion pour moins de 2 caractères', async () => {
    renderBar()
    await flushSpecialtiesQuery()
    fireEvent.change(screen.getByPlaceholderText('Spécialité, praticien...'), { target: { value: 'v' } })
    expect(screen.queryByText('Vétérinaire')).not.toBeInTheDocument()
  })

  it('remplit le champ spécialité au clic sur une suggestion', async () => {
    renderBar()
    await flushSpecialtiesQuery()
    const input = screen.getByPlaceholderText('Spécialité, praticien...')
    fireEvent.change(input, { target: { value: 'toi' } })
    expect(screen.getByText('Toiletteur')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Toiletteur'))
    expect(input).toHaveValue('Toiletteur')
  })

  it('géolocalise et navigue avec lat/lng au clic sur "Autour de moi"', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 48.85, longitude: 2.35 } } as GeolocationPosition)
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    renderBar()
    fireEvent.focus(screen.getByPlaceholderText('Ville'))
    fireEvent.click(screen.getByText('Autour de moi'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    const url = mockNavigate.mock.calls[0][0]
    expect(url).toContain('lat=48.85')
    expect(url).toContain('lng=2.35')
    expect(url).not.toContain('city=')

    vi.unstubAllGlobals()
  })

  it('affiche un message d\'erreur si la géolocalisation est refusée', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1 } as GeolocationPositionError)
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    renderBar()
    fireEvent.focus(screen.getByPlaceholderText('Ville'))
    fireEvent.click(screen.getByText('Autour de moi'))

    await waitFor(() => expect(screen.getByText(/Impossible de récupérer votre position/)).toBeInTheDocument())

    vi.unstubAllGlobals()
  })

  it('affiche un message si la géolocalisation n\'est pas supportée par le navigateur', () => {
    vi.stubGlobal('navigator', {})
    renderBar()
    fireEvent.focus(screen.getByPlaceholderText('Ville'))
    fireEvent.click(screen.getByText('Autour de moi'))
    expect(screen.getByText(/n'est pas prise en charge/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('agrandit les champs avec la prop "large"', () => {
    renderBar({ large: true })
    expect(screen.getByPlaceholderText('Spécialité, praticien...')).toHaveClass('py-4')
  })
})
