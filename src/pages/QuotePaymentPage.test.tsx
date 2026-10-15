import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const state = {
  offer: null as any, loading: false, error: null as any,
  startError: null as any,
}
const mutate = vi.fn()

vi.mock('@/hooks/useData', () => ({
  useQuoteOffer: () => ({ data: state.offer, isLoading: state.loading, error: state.error }),
  useStartQuoteCheckout: () => ({ mutate, isPending: false, error: state.startError }),
}))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))

import QuotePaymentPage from './QuotePaymentPage'

const TOKEN = 'b'.repeat(64)
function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/paiement-devis/${TOKEN}${search}`]}>
      <Routes><Route path="/paiement-devis/:token" element={<QuotePaymentPage />} /></Routes>
    </MemoryRouter>,
  )
}
const offer = (over: Record<string, unknown> = {}) => ({
  clinic_name: 'Clinique des Lilas', offer_price_cents: 15560, offer_max_practitioners: 8, paid_at: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  state.offer = offer(); state.loading = false; state.error = null; state.startError = null
})

describe('QuotePaymentPage', () => {
  it("présente le prix du devis (TVA non applicable) et le nombre de praticiens", () => {
    renderPage()
    expect(screen.getByText(/Clinique des Lilas/)).toBeInTheDocument()
    expect(screen.getByText(/155,60 €/)).toBeInTheDocument()
    expect(screen.getByText(/\/ mois/)).toBeInTheDocument()
    expect(screen.queryByText(/\bHT\b/)).not.toBeInTheDocument()
    expect(screen.getByText(/cabinet de 8 praticiens au plus/)).toBeInTheDocument()
    expect(screen.getByText(/TVA non applicable, art\. 293 B du CGI/)).toBeInTheDocument()
  })

  it("sans les conditions cochées, explique quoi faire au lieu de partir payer", () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Payer par carte' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Cochez la case/)
    expect(mutate).not.toHaveBeenCalled()
  })

  it("ouvre le paiement avec le jeton du lien une fois les conditions cochées", () => {
    renderPage()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Payer par carte' }))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).toEqual({ token: TOKEN })
    expect(typeof mutate.mock.calls[0][1].onSuccess).toBe('function')
  })

  it("affiche l'erreur renvoyée quand le paiement ne peut pas s'ouvrir", () => {
    state.startError = new Error("L'abonnement est proposé dès que votre dossier est validé par notre équipe.")
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/dossier est validé/)
  })

  it("un lien qui n'est pas celui de ce compte (ou inconnu) renvoie vers le bon compte et le contact", () => {
    state.offer = null
    renderPage()
    expect(screen.getByText(/associé à un autre compte/)).toBeInTheDocument()
    expect(screen.getByText(/contact\.animeaux@gmail\.com/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Payer par carte' })).not.toBeInTheDocument()
  })

  it("un devis déjà réglé ne propose plus de payer", () => {
    state.offer = offer({ paid_at: '2026-10-17T10:00:00Z' })
    renderPage()
    expect(screen.getByText(/déjà été réglé/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir mon abonnement' })).toHaveAttribute('href', '/abonnement')
    expect(screen.queryByRole('button', { name: 'Payer par carte' })).not.toBeInTheDocument()
  })

  it("un lien désactivé (offre incomplète) ne propose pas de payer", () => {
    state.offer = offer({ offer_price_cents: null })
    renderPage()
    expect(screen.getByText(/n'est plus actif/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Payer par carte' })).not.toBeInTheDocument()
  })

  it("rassure après un paiement annulé", () => {
    renderPage('?paiement=annule')
    expect(screen.getByText(/rien n'a été débité/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Payer par carte' })).toBeInTheDocument()
  })

  it('gère le chargement et une erreur de lecture', () => {
    state.loading = true
    const { unmount } = renderPage()
    expect(screen.getByText('Chargement...')).toBeInTheDocument()
    unmount()
    state.loading = false; state.error = new Error('x')
    renderPage()
    expect(screen.getByText(/Impossible de charger ce devis/)).toBeInTheDocument()
  })
})
