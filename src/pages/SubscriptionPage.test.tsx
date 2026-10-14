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
    // Aucune offre n'est « recommandée » : on ne connaît pas la situation du praticien.
    expect(screen.queryByText(/recommand/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Prix mensuels hors taxes/)).toBeInTheDocument()
  })

  it("sans avoir coché les conditions, un clic sur « Choisir l'abonnement » explique quoi faire au lieu de partir payer", () => {
    renderPage()
    const choose = screen.getByRole('button', { name: "Choisir l'abonnement" })
    expect(choose).toBeEnabled() // pas de bouton grisé sans explication

    fireEvent.click(choose)
    expect(screen.getByRole('alert')).toHaveTextContent(/Cochez la case/)
    expect(screen.getByRole('alert')).toHaveTextContent(/choisir un abonnement/)
    expect(mutateCheckout).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it("une fois les conditions cochées, le message disparaît et le paiement démarre", () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: "Choisir l'abonnement" }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "Choisir l'abonnement" }))
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

  it("un abonné peut revenir à l'offre gratuite : le bouton ouvre le portail de résiliation", () => {
    state.hasPro = true
    state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'pro' }
    state.subscriptions = [{ status: 'active', current_period_end: '2026-12-01T10:00:00Z', cancel_at_period_end: false, created_at: '2026-10-13' }]
    renderPage()

    expect(screen.getByText(/jusqu'à la fin de la période déjà payée/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Revenir à l'offre gratuite" }))
    expect(mutatePortal).toHaveBeenCalledTimes(1)
  })

  it("si la résiliation est déjà programmée, annonce la date du retour à la gratuite sans proposer le bouton", () => {
    state.hasPro = true
    state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'pro' }
    state.subscriptions = [{ status: 'active', current_period_end: '2026-12-01T10:00:00Z', cancel_at_period_end: true, created_at: '2026-10-13' }]
    renderPage()

    expect(screen.getByText(/Retour à l'offre gratuite prévu le 1 décembre 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Revenir à l'offre gratuite" })).not.toBeInTheDocument()
  })

  it("une offre « fondateur » (sans abonnement Stripe) est présentée comme offerte, sans bouton de gestion", () => {
    state.hasPro = true
    state.doctor = { id: 'doc-1', verification_status: 'verified', plan: 'pro' }
    renderPage()
    expect(screen.getByText(/offert par Animéaux/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gérer mon abonnement' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Revenir à l'offre gratuite" })).not.toBeInTheDocument()
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
    // mène au tableau de bord, où la visite guidée se lance à la première arrivée
    expect(screen.getByRole('link', { name: 'Découvrir mon espace' })).toHaveAttribute('href', '/dashboard/doctor')
  })

  it("au retour d'un paiement annulé, rassure : rien n'a été débité", () => {
    renderPage('?paiement=annule')
    expect(screen.getByText(/rien n'a été débité/)).toBeInTheDocument()
  })

  it("ne met aucune offre en avant par défaut, puis passe en orange la carte survolée (jamais deux à la fois)", () => {
    const { container } = renderPage()
    const card = (id: string) => container.querySelector(`[data-plan="${id}"]`)!
    for (const id of ['free', 'pro', 'cabinet']) expect(card(id).getAttribute('data-highlighted')).toBe('false')

    fireEvent.mouseEnter(card('cabinet'))
    expect(card('cabinet').getAttribute('data-highlighted')).toBe('true')
    expect(card('pro').getAttribute('data-highlighted')).toBe('false')

    fireEvent.mouseEnter(card('pro'))
    expect(card('pro').getAttribute('data-highlighted')).toBe('true')
    expect(card('cabinet').getAttribute('data-highlighted')).toBe('false')
  })

  it("la formule gratuite ne passe jamais en orange, même survolée", () => {
    const { container } = renderPage()
    const free = container.querySelector('[data-plan="free"]')!
    fireEvent.mouseEnter(free)
    expect(free.getAttribute('data-highlighted')).toBe('false')
    expect(container.querySelector('[data-plan="pro"]')!.getAttribute('data-highlighted')).toBe('false')
  })

  it("pour le cabinet aussi : sans conditions cochées, un message s'affiche et rien ne s'ouvre", () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: "Choisir l'abonnement cabinet" }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Cochez la case/)
    expect(screen.queryByPlaceholderText('Nom du cabinet')).not.toBeInTheDocument()
    expect(mutateCheckout).not.toHaveBeenCalled()
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
