import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const state = { quotes: [] as any[], loading: false, error: null as any }
const mutateAsync = vi.fn()

vi.mock('@/hooks/useData', () => ({
  useAdminQuoteRequests: () => ({ data: state.quotes, isLoading: state.loading, error: state.error }),
  useAdminUpdateQuoteRequest: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))

import AdminQuotesView from './AdminQuotesView'

const quote = (over: Record<string, unknown> = {}) => ({
  id: 'q1', created_at: '2026-10-15T09:30:00Z', requester_name: 'Léa Martin', requester_email: 'lea@example.org',
  clinic_name: 'Clinique des Lilas', city: 'Lyon', practitioner_count: 8, practitioner_count_next_year: 10,
  secretary_count: 2, phone: '06 12 34 56 78', message: 'Plusieurs sites.', status: 'new', admin_note: null,
  admin_notified_at: '2026-10-15T09:30:05Z', ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mutateAsync.mockResolvedValue(undefined)
  state.quotes = []; state.loading = false; state.error = null
})

describe('AdminQuotesView', () => {
  it('liste une demande avec toutes les réponses et un lien pour écrire au cabinet', () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    expect(screen.getByText(/Clinique des Lilas — Lyon/)).toBeInTheDocument()
    expect(screen.getByText('Plusieurs sites.')).toBeInTheDocument()
    expect(screen.getByText('lea@example.org').getAttribute('href')).toBe('mailto:lea@example.org')
    expect(screen.getByText(/1 nouvelle/)).toBeInTheDocument()
  })

  it('« À traiter » masque les demandes acceptées ou refusées, « Toutes » les montre', () => {
    state.quotes = [quote(), quote({ id: 'q2', clinic_name: 'Cabinet Sud', status: 'accepted' }), quote({ id: 'q3', clinic_name: 'Cabinet Est', status: 'declined' })]
    render(<AdminQuotesView onBack={() => {}} />)
    expect(screen.queryByText(/Cabinet Sud/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }))
    expect(screen.getByText(/Cabinet Sud/)).toBeInTheDocument()
    expect(screen.getByText(/Cabinet Est/)).toBeInTheDocument()
  })

  it('change le statut', async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Devis envoyé' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 'q1', status: 'quote_sent' }))
  })

  it('enregistre la note en quittant le champ, seulement si elle a changé', async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    const note = screen.getByLabelText(/Note/)
    fireEvent.blur(note)
    expect(mutateAsync).not.toHaveBeenCalled()
    fireEvent.change(note, { target: { value: 'Proposé 450 € HT' } })
    fireEvent.blur(note)
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 'q1', adminNote: 'Proposé 450 € HT' }))
  })

  it("signale une demande dont l'email de notification n'est pas parti", () => {
    state.quotes = [quote({ admin_notified_at: null })]
    render(<AdminQuotesView onBack={() => {}} />)
    expect(screen.getByText(/n'a pas pu être envoyé/)).toBeInTheDocument()
  })

  it('affiche les états vide, chargement et erreur', () => {
    const { rerender } = render(<AdminQuotesView onBack={() => {}} />)
    expect(screen.getByText('Aucune demande à traiter.')).toBeInTheDocument()
    state.loading = true
    rerender(<AdminQuotesView onBack={() => {}} />)
    expect(screen.getByText('Chargement...')).toBeInTheDocument()
    state.loading = false; state.error = new Error('x')
    rerender(<AdminQuotesView onBack={() => {}} />)
    expect(screen.getByText(/Impossible de charger/)).toBeInTheDocument()
  })
})
