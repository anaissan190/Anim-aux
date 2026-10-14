import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// La page assemble plusieurs hooks de données : on les remplace par des valeurs contrôlées.
const state = {
  doctor: { id: 'doc-1', verification_status: 'verified', plan: 'free' } as any,
  clinic: null as any,
  hasPro: false as boolean | undefined,
  subscriptions: [] as any[],
}
const mutateCheckout = vi.fn()
const mutatePortal = vi.fn()

vi.mock('@/hooks/useData', () => ({
  useCurrentDoctor: () => ({ data: state.doctor }),
  useMyClinic: () => ({ data: state.clinic }),
  useDoctorHasPro: () => ({ data: state.hasPro }),
  useMySubscriptions: () => ({ data: state.subscriptions }),
  useStartCheckout: () => ({ mutate: mutateCheckout, isPending: false, error: null }),
  useOpenBillingPortal: () => ({ mutate: mutatePortal, isPending: false, error: null }),
}))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/BackButton', () => ({ default: () => null }))

import { useAuthStore } from '@/lib/authStore'
import SubscriptionPage from './SubscriptionPage'

function renderPage(search = '') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/abonnement${search}`]}><SubscriptionPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'free' }
  state.clinic = null
  state.hasPro = false
  state.subscriptions = []
  useAuthStore.setState({ user: { id: 'u1', email: 'a@a.fr', role: 'doctor', is_admin: false, created_at: '' } as any, profile: null, loading: false })
})

describe('SubscriptionPage', () => {
  it('affiche les trois offres avec leurs prix hors taxe', () => {
    renderPage()
    expect(screen.getByText('Gratuite')).toBeInTheDocument()
    expect(screen.getByText(/39,90 €/)).toBeInTheDocument()
    expect(screen.getByText(/95,90 €/)).toBeInTheDocument()
    expect(screen.getByText('Recommandé')).toBeInTheDocument()
    expect(screen.getByText(/Prix mensuels hors taxes/)).toBeInTheDocument()
  })

  it("n'envoie vers le paiement qu'après acceptation des conditions", () => {
    renderPage()
    const choose = screen.getByRole('button', { name: "Choisir l'abonnement" })
    expect(choose).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(choose).toBeEnabled()
    fireEvent.click(choose)

    expect(mutateCheckout).toHaveBeenCalledTimes(1)
    expect(mutateCheckout.mock.calls[0][0]).toMatchObject({ plan: 'pro' })
  })

  it("explique qu'on ne paie jamais avant la validation du dossier, et bloque le paiement", () => {
    state.doctor = { id: 'doc-1', verification_status: 'pending', plan: 'free' }
    renderPage()
    expect(screen.getByText(/vous ne payez jamais avant/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: "Choisir l'abonnement" })).toBeDisabled()
  })

  it("pour un abonné : montre l'état, la date de renouvellement et le bouton de gestion (portail)", () => {
    state.hasPro = true
    state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'pro' }
    state.subscriptions = [{ status: 'active', current_period_end: '2026-12-01T10:00:00Z', cancel_at_period_end: false, created_at: '2026-10-13' }]
    renderPage()

    expect(screen.getByText(/prochain renouvellement le 1 décembre 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Votre offre actuelle/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Gérer mon abonnement' }))
    expect(mutatePortal).toHaveBeenCalledTimes(1)
  })

  it("une offre « fondateur » (sans abonnement Stripe) est présentée comme offerte, sans bouton de gestion", () => {
    state.hasPro = true
    state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'pro' }
    renderPage()
    expect(screen.getByText(/offert par Animéaux/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gérer mon abonnement' })).not.toBeInTheDocument()
  })

  it("au retour d'un paiement réussi, annonce l'activation en cours puis l'abonnement actif", () => {
    renderPage('?paiement=succes')
    expect(screen.getByText(/Activation de votre abonnement en cours/)).toBeInTheDocument()
  })

  it("confirme l'activation quand l'offre est bien passée en abonnement", () => {
    state.hasPro = true
    state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'pro' }
    renderPage('?paiement=succes')
    expect(screen.getByText(/votre abonnement est actif/)).toBeInTheDocument()
  })

  it("au retour d'un paiement annulé, rassure : rien n'a été débité", () => {
    renderPage('?paiement=annule')
    expect(screen.getByText(/rien n'a été débité/)).toBeInTheDocument()
  })

  it("le bouton cabinet est grisé comme celui de l'abonnement tant que les conditions ne sont pas acceptées", () => {
    renderPage()
    expect(screen.getByRole('button', { name: "Choisir l'abonnement cabinet" })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: "Choisir l'abonnement cabinet" })).toBeEnabled()
  })

  it("cabinet sans cabinet existant : demande le nom avant d'aller payer", () => {
    renderPage()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: "Choisir l'abonnement cabinet" }))

    const next = screen.getByRole('button', { name: 'Continuer vers le paiement' })
    expect(next).toBeDisabled() // nom vide
    fireEvent.change(screen.getByPlaceholderText('Nom du cabinet'), { target: { value: 'Cabinet du Parc' } })
    fireEvent.change(screen.getByPlaceholderText('Ville (facultatif)'), { target: { value: 'Paris' } })
    expect(next).toBeEnabled()
    fireEvent.click(next)

    expect(mutateCheckout.mock.calls[0][0]).toEqual({ plan: 'cabinet', clinicName: 'Cabinet du Parc', clinicCity: 'Paris' })
  })

  it("un membre qui n'est pas le créateur du cabinet ne peut pas l'activer", () => {
    state.clinic = { id: 'c1', owner_id: 'autre', plan: 'free' }
    renderPage()
    expect(screen.getByText(/Seul le créateur du cabinet peut activer/)).toBeInTheDocument()
  })
})
