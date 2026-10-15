import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const state = { quotes: [] as any[], loading: false, error: null as any }
const mutateAsync = vi.fn()
const prepareAsync = vi.fn()
const clearAsync = vi.fn()

vi.mock('@/hooks/useData', () => ({
  useAdminQuoteRequests: () => ({ data: state.quotes, isLoading: state.loading, error: state.error }),
  useAdminUpdateQuoteRequest: () => ({ mutateAsync, isPending: false }),
  useAdminPrepareQuotePayment: () => ({ mutateAsync: prepareAsync, isPending: false }),
  useAdminClearQuotePayment: () => ({ mutateAsync: clearAsync, isPending: false }),
}))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))

import AdminQuotesView from './AdminQuotesView'

const quote = (over: Record<string, unknown> = {}) => ({
  id: 'q1', created_at: '2026-10-15T09:30:00Z', requester_name: 'Léa Martin', requester_email: 'lea@example.org',
  clinic_name: 'Clinique des Lilas', city: 'Lyon', practitioner_count: 8, practitioner_count_next_year: 10,
  secretary_count: 2, phone: '06 12 34 56 78', message: 'Plusieurs sites.', status: 'new', admin_note: null,
  admin_notified_at: '2026-10-15T09:30:05Z',
  offer_price_cents: null, offer_max_practitioners: null, payment_token: null, payment_prepared_at: null,
  checkout_started_at: null, paid_at: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mutateAsync.mockResolvedValue(undefined)
  prepareAsync.mockResolvedValue('t'.repeat(64))
  clearAsync.mockResolvedValue(undefined)
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

  it("quand une demande quitte « À traiter », dit où elle est passée et permet d'annuler", async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Devis accepté' }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(/« Clinique des Lilas » est passée en « Devis accepté »/)
    expect(notice).toHaveTextContent(/retrouve-la dans « Toutes »/)

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({ id: 'q1', status: 'new' }))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it("un changement de statut qui laisse la demande dans « À traiter » ne parle pas de la liste", async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Devis envoyé' }))
    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(/« Devis envoyé »/)
    expect(notice).not.toHaveTextContent(/retrouve-la/)
  })

  it("si l'annulation échoue, le dit", async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sans suite' }))
    await screen.findByRole('status')
    mutateAsync.mockRejectedValueOnce(new Error('Réseau coupé'))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(await screen.findByText('Réseau coupé')).toBeInTheDocument()
  })

  it('enregistre la note en quittant le champ, seulement si elle a changé', async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    const note = screen.getByLabelText(/Note/)
    fireEvent.blur(note)
    expect(mutateAsync).not.toHaveBeenCalled()
    fireEvent.change(note, { target: { value: 'Proposé 450 €' } })
    fireEvent.blur(note)
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 'q1', adminNote: 'Proposé 450 €' }))
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

describe('AdminQuotesView — lien de paiement du devis', () => {
  const TOKEN = 'a'.repeat(64)

  it("propose le prix de la règle (95,90 € + 19,90 € par praticien en plus), modifiable", () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    expect((screen.getByLabelText(/Praticiens \(maximum\)/) as HTMLInputElement).value).toBe('8')
    expect((screen.getByLabelText(/Prix par mois/) as HTMLInputElement).value).toBe('155,60')
  })

  it("crée le lien avec le nombre de praticiens et le prix saisis", async () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Prix par mois/), { target: { value: '140' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien de paiement' }))
    await waitFor(() => expect(prepareAsync).toHaveBeenCalledWith({ quoteId: 'q1', maxPractitioners: 8, priceCents: 14000 }))
  })

  it("refuse une offre incorrecte et l'explique, sans rien créer", () => {
    state.quotes = [quote()]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Prix par mois/), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien de paiement' }))
    expect(screen.getByText(/Indique le prix mensuel/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Praticiens \(maximum\)/), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText(/Prix par mois/), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien de paiement' }))
    expect(screen.getByText(/entre 6 et 200/)).toBeInTheDocument()
    expect(prepareAsync).not.toHaveBeenCalled()
  })

  it("affiche l'erreur de la base quand la création échoue", async () => {
    state.quotes = [quote()]
    prepareAsync.mockRejectedValueOnce(new Error('Cette demande est déjà payée'))
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien de paiement' }))
    expect(await screen.findByText('Cette demande est déjà payée')).toBeInTheDocument()
  })

  it("montre le lien à joindre à l'email, le copie et permet de le désactiver", async () => {
    state.quotes = [quote({ payment_token: TOKEN, offer_price_cents: 15560, offer_max_practitioners: 8 })]
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<AdminQuotesView onBack={() => {}} />)

    const link = (screen.getByLabelText(/Lien à joindre/) as HTMLInputElement).value
    expect(link).toBe(`${window.location.origin}/paiement-devis/${TOKEN}`)
    expect(screen.getByText(/155,60 € par mois, jusqu'à 8 praticiens/)).toBeInTheDocument()
    expect(screen.getByText(/n'a pas encore ouvert la page de paiement/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link))
    expect(await screen.findByRole('button', { name: 'Copié ✓' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Mettre à jour le prix' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver le lien' }))
    await waitFor(() => expect(clearAsync).toHaveBeenCalledWith('q1'))
  })

  it("indique quand le cabinet a ouvert la page de paiement", () => {
    state.quotes = [quote({ payment_token: TOKEN, offer_price_cents: 15560, offer_max_practitioners: 8, checkout_started_at: '2026-10-16T09:15:00Z' })]
    render(<AdminQuotesView onBack={() => {}} />)
    expect(screen.getByText(/a ouvert la page de paiement le 16 octobre/)).toBeInTheDocument()
  })

  it("une demande payée n'a plus de formulaire : elle annonce l'abonnement actif", () => {
    state.quotes = [quote({ status: 'accepted', paid_at: '2026-10-17T10:00:00Z', offer_price_cents: 15560, offer_max_practitioners: 8, payment_token: TOKEN })]
    render(<AdminQuotesView onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }))
    expect(screen.getByText(/Payé le 17 octobre 2026/)).toBeInTheDocument()
    expect(screen.getByText(/155,60 € par mois, jusqu'à 8 praticiens/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Créer le lien de paiement' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Lien à joindre/)).not.toBeInTheDocument()
  })
})
