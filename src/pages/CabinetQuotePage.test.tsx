import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const state = { clinic: null as any }
const mutate = vi.fn()

vi.mock('@/hooks/useData', () => ({
  useCurrentDoctor: () => ({ data: { id: 'doc-1' } }),
  useMyClinic: () => ({ data: state.clinic }),
  useRequestCabinetQuote: () => ({ mutate, isPending: false }),
}))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/BackButton', () => ({ default: () => null }))

import { useAuthStore } from '@/lib/authStore'
import CabinetQuotePage from './CabinetQuotePage'

function renderPage() {
  return render(<MemoryRouter><CabinetQuotePage /></MemoryRouter>)
}
const fill = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  state.clinic = null
  useAuthStore.setState({ user: { id: 'u1', email: 'lea@example.org', role: 'doctor', is_admin: false, created_at: '' } as any, profile: null, loading: false })
})

describe('CabinetQuotePage', () => {
  it('pré-remplit le nom et la ville avec le cabinet du praticien', () => {
    state.clinic = { name: 'Clinique des Lilas', city: 'Lyon' }
    renderPage()
    expect((screen.getByLabelText('Nom du cabinet') as HTMLInputElement).value).toBe('Clinique des Lilas')
    expect((screen.getByLabelText(/Ville/) as HTMLInputElement).value).toBe('Lyon')
  })

  it("sans nombre de praticiens, explique ce qui manque au lieu d'envoyer", () => {
    renderPage()
    fill('Nom du cabinet', 'Cabinet Nord')
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/nombre de praticiens/)
    expect(mutate).not.toHaveBeenCalled()
  })

  it("pour 5 praticiens ou moins, renvoie vers l'abonnement cabinet", () => {
    renderPage()
    fill('Nom du cabinet', 'Cabinet Nord')
    fill(/Praticiens aujourd/, '4')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/5 praticiens ou moins/)
    expect(mutate).not.toHaveBeenCalled()
  })

  it("sans la case cochée, explique qu'elle est nécessaire", () => {
    renderPage()
    fill('Nom du cabinet', 'Cabinet Nord')
    fill(/Praticiens aujourd/, '8')
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Cochez la case/)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('envoie la demande complète, puis confirme', () => {
    mutate.mockImplementation((_input: unknown, opts: { onSuccess: () => void }) => opts.onSuccess())
    renderPage()
    fill('Nom du cabinet', 'Cabinet Nord')
    fill(/Praticiens aujourd/, '8')
    fill(/Dans un an/, '10')
    fill(/secrétariat/, '2')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).toMatchObject({
      clinicName: 'Cabinet Nord', practitionerCount: '8', practitionerCountNextYear: '10', secretaryCount: '2', consent: true,
    })
    expect(screen.getByText('Demande envoyée')).toBeInTheDocument()
    expect(screen.getByText(/lea@example\.org/)).toBeInTheDocument()
  })

  it("affiche l'erreur renvoyée par le serveur et garde le formulaire", () => {
    mutate.mockImplementation((_input: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Une erreur est survenue.')))
    renderPage()
    fill('Nom du cabinet', 'Cabinet Nord')
    fill(/Praticiens aujourd/, '8')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue.')
    expect(screen.queryByText('Demande envoyée')).not.toBeInTheDocument()
  })
})
