import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const state = { launch: { phase: 'open', publicLaunchDate: null } as any }
const signUp = vi.fn()

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signUp: (...a: any[]) => signUp(...a) } } }))
vi.mock('@/hooks/useData', () => ({ useLaunchSettings: () => ({ data: state.launch }) }))
vi.mock('@/components/ui/Turnstile', () => ({ default: () => null }))
vi.mock('@/components/doctor/PractitionerTypePicker', () => ({
  default: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['veterinaire'])}>choisir un métier</button>
  ),
}))

import RegisterPage from './RegisterPage'

function renderPage(search = '') {
  return render(<MemoryRouter initialEntries={[`/register${search}`]}><RegisterPage /></MemoryRouter>)
}

function fillIdentity() {
  fireEvent.change(screen.getByPlaceholderText('Marie'), { target: { value: 'Marie' } })
  fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Dupont' } })
  fireEvent.change(screen.getByPlaceholderText('vous@email.fr'), { target: { value: 'marie@exemple.fr' } })
  fireEvent.change(screen.getByPlaceholderText('Minimum 8 caractères'), { target: { value: 'motdepasse1' } })
  fireEvent.click(screen.getByLabelText(/J'accepte les/))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
  localStorage.clear()
  state.launch = { phase: 'open', publicLaunchDate: null }
  signUp.mockResolvedValue({ data: { user: { identities: [{}] } }, error: null })
})

describe('RegisterPage', () => {
  it('site ouvert : propose propriétaire et praticien, sans choix de formule', () => {
    renderPage()
    expect(screen.getByText('🙋 Propriétaire')).toBeInTheDocument()
    expect(screen.getByText('🩺 Praticien')).toBeInTheDocument()
    expect(screen.queryByText('Quelle formule vous intéresse ?')).not.toBeInTheDocument()
  })

  describe('pendant le pré-lancement', () => {
    beforeEach(() => { state.launch = { phase: 'prelaunch', publicLaunchDate: '2027-01-15' } })

    it("n'inscrit que des praticiens et affiche la date d'ouverture", () => {
      renderPage()
      expect(screen.getByText('Pré-inscription praticien')).toBeInTheDocument()
      expect(screen.getByText(/Ouverture le 15 janvier/)).toBeInTheDocument()
      expect(screen.queryByText('🙋 Propriétaire')).not.toBeInTheDocument()
      expect(screen.getByText('Quelle formule vous intéresse ?')).toBeInTheDocument()
    })

    it("refuse l'inscription tant qu'aucune formule n'est choisie", async () => {
      renderPage()
      fillIdentity()
      fireEvent.click(screen.getByText('choisir un métier'))
      fireEvent.click(screen.getByLabelText(/Charte bien-être animal|Je m'engage/))
      fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
      expect(await screen.findByText(/Indiquez la formule qui vous intéresse/)).toBeInTheDocument()
      expect(signUp).not.toHaveBeenCalled()
    })

    it("transmet la formule choisie à l'inscription", async () => {
      renderPage()
      fillIdentity()
      fireEvent.click(screen.getByText('choisir un métier'))
      fireEvent.click(screen.getByLabelText(/Je m'engage/))
      fireEvent.click(screen.getByRole('radio', { name: /39,90 €/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
      await waitFor(() => expect(signUp).toHaveBeenCalled())
      const { options } = signUp.mock.calls[0][0]
      expect(options.data).toMatchObject({ role: 'doctor', intended_plan: 'pro' })
    })
  })
})
