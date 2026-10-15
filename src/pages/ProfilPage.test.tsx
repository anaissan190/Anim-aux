// Test de fumée du profil patient (/profil, aussi ouvert par l'administrateur et, par adresse directe,
// par un praticien) : on affiche vraiment la page avec des données fournies à la place de Supabase.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({
  overrides: {} as Record<string, () => unknown>,
  updateProfile: vi.fn(),
  updateDoctor: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  deleteAccount: vi.fn(),
}))

vi.mock('@/hooks/useData', () => new Proxy({}, {
  has: () => true,
  get: (_t, name: string) => {
    if (name === '__esModule') return true
    if (name === 'then') return undefined
    const mut = (fn: unknown) => () => ({ mutateAsync: fn, mutate: vi.fn(), isPending: false })
    if (name === 'useUpdateProfile') return mut(h.updateProfile)
    if (name === 'useUpdateDoctor') return mut(h.updateDoctor)
    if (name === 'useEnablePushNotifications') return mut(h.enablePush)
    if (name === 'useDisablePushNotifications') return mut(h.disablePush)
    if (name === 'useDeleteAccount') return mut(h.deleteAccount)
    return () => (h.overrides[name]?.() ?? { data: undefined, isLoading: false, error: null, mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })
  },
}))
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: 'x' } }) }) } } }))
vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/BackButton', () => ({ default: () => null }))
vi.mock('@/components/mobile/MobileHeader', () => ({ default: () => null }))
vi.mock('@/components/mobile/MobileTabBar', () => ({ default: () => null }))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => <div data-testid="bio-editor" /> }))
vi.mock('@/components/doctor/PractitionerTypePicker', () => ({ default: () => <div data-testid="type-picker" /> }))

import { useAuthStore } from '@/lib/authStore'
import { showToast } from '@/lib/toast'
import ProfilPage from './ProfilPage'

const profileRow = {
  first_name: 'Camille', last_name: 'Dupont', avatar_url: null, phone: '06 12 34 56 78', address: '12 rue des Lilas',
  emergency_contact_name: '', emergency_contact_phone: '',
}

// Objets stables : comme le vrai cache de données, un même objet d'un affichage à l'autre (un nouvel
// objet à chaque fois relancerait en boucle le préremplissage du formulaire).
const doctorRow = { id: 'd1', specialties: ['Vétérinaire'], verification_status: 'verified', is_listed: true, bio: '', accepted_species: [] }
const noSubscriptions: unknown[] = []

function setup(over: { role?: string; isAdmin?: boolean; push?: unknown; subscriptions?: unknown[]; profile?: Record<string, unknown> } = {}) {
  h.overrides = {
    useCurrentDoctor: () => ({ data: over.role === 'doctor' ? doctorRow : undefined }),
    useMyClinic: () => ({ data: undefined, isLoading: false }),
    useDoctorHasPro: () => ({ data: true }),
    useMySubscriptions: () => ({ data: over.subscriptions ?? noSubscriptions }),
    usePushSubscriptionStatus: () => ({ data: 'push' in over ? over.push : { supported: true, subscribed: false } }),
  }
  useAuthStore.setState({
    user: { id: 'u1', email: 'camille@exemple.fr', role: over.role ?? 'patient', is_admin: over.isAdmin ?? false, created_at: '' } as any,
    profile: { ...profileRow, ...over.profile } as any, loading: false,
  })
}

const renderAt = (url = '/profil') => render(<MemoryRouter initialEntries={[url]}><ProfilPage /></MemoryRouter>)
const tab = (name: RegExp | string) => screen.getByRole('tab', { name })

beforeEach(() => {
  vi.clearAllMocks()
  h.updateProfile.mockResolvedValue(undefined)
  h.updateDoctor.mockResolvedValue(undefined)
  h.enablePush.mockResolvedValue(undefined)
  h.disablePush.mockResolvedValue(undefined)
  h.deleteAccount.mockResolvedValue(undefined)
})

describe('Profil patient', () => {
  beforeEach(() => setup())

  it("affiche l'en-tête (nom, email, rôle, jauge) et trois sous-onglets", () => {
    renderAt()
    expect(screen.getByText('Camille Dupont')).toBeInTheDocument()
    expect(screen.getAllByText('camille@exemple.fr').length).toBeGreaterThan(0)
    expect(screen.getByText('Propriétaire')).toBeInTheDocument()
    // téléphone et adresse renseignés, ni photo ni contact d'urgence : 2 sur 4
    expect(screen.getByText('Profil complété à 50 %')).toBeInTheDocument()
    expect(screen.getByText('Ajoutez une photo')).toBeInTheDocument()
    const names = within(screen.getByRole('tablist', { name: 'Sections du profil' })).getAllByRole('tab').map(t => t.textContent)
    expect(names).toEqual(['Mon profil', 'Notifications', 'Données et compte'])
  })

  it("range « Mon profil » en trois cartes : identité, coordonnées, contact d'urgence", () => {
    renderAt()
    for (const title of ['Identité', 'Coordonnées', "🚨 Contact d'urgence"]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Prénom')).toHaveValue('Camille')
    expect(screen.queryByText(/Informations professionnelles/)).not.toBeInTheDocument()
  })

  it("n'a qu'UN bouton « Enregistrer », tout en bas du formulaire", () => {
    renderAt()
    const saves = screen.getAllByRole('button', { name: 'Enregistrer mes informations' })
    expect(saves).toHaveLength(1)
    for (const label of ['Prénom', 'Téléphone', 'Adresse postale']) {
      const fields = screen.getAllByLabelText(label)
      expect(fields[fields.length - 1].compareDocumentPosition(saves[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    const emergency = screen.getByLabelText('Nom', { selector: '#profil-emergency-name' })
    expect(emergency.compareDocumentPosition(saves[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("enregistre tous les champs d'un coup, contact d'urgence compris", async () => {
    renderAt()
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille-Anne' } })
    fireEvent.change(screen.getByLabelText('Nom', { selector: '#profil-emergency-name' }), { target: { value: 'Marie Dupont' } })
    fireEvent.change(screen.getByLabelText('Téléphone', { selector: '#profil-emergency-phone' }), { target: { value: '06 00 00 00 01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))
    await waitFor(() => expect(h.updateProfile).toHaveBeenCalledTimes(1))
    expect(h.updateProfile.mock.calls[0][0]).toEqual({
      first_name: 'Camille-Anne', last_name: 'Dupont', phone: '06 12 34 56 78', address: '12 rue des Lilas',
      emergency_contact_name: 'Marie Dupont', emergency_contact_phone: '06 00 00 00 01',
    })
    expect(h.updateDoctor).not.toHaveBeenCalled()
    await waitFor(() => expect(showToast).toHaveBeenCalled())
  })

  it("garde les modifications non enregistrées en changeant de sous-onglet", () => {
    renderAt()
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille-Anne' } })
    fireEvent.click(tab('Notifications'))
    fireEvent.click(tab('Mon profil'))
    expect(screen.getByLabelText('Prénom')).toHaveValue('Camille-Anne')
  })

  it("« Notifications » : un interrupteur qui active puis désactive tout de suite", async () => {
    renderAt()
    fireEvent.click(tab('Notifications'))
    const sw = screen.getByRole('switch', { name: /Notifications sur cet appareil/ })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    await waitFor(() => expect(h.enablePush).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Enregistrer mes informations' })).not.toBeInTheDocument()
  })

  it("« Données et compte » regroupe l'export, la déconnexion et la zone de danger", () => {
    renderAt()
    fireEvent.click(tab('Données et compte'))
    expect(screen.getByText('Mes données')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Déconnexion/ })).toBeInTheDocument()
    expect(screen.getByText('Zone de danger')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Identité' })).not.toBeInTheDocument()
  })

  it("la suppression du compte garde sa confirmation : il faut taper SUPPRIMER", async () => {
    renderAt('/profil?section=donnees')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    const confirm = screen.getByRole('button', { name: 'Supprimer définitivement' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('SUPPRIMER'), { target: { value: 'SUPPRIMER' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(h.deleteAccount).toHaveBeenCalledTimes(1))
  })

  it("s'ouvre directement sur la section demandée, ou sur « Mon profil » si elle est inconnue", () => {
    const { unmount } = renderAt('/profil?section=notifications')
    expect(tab('Notifications')).toHaveAttribute('aria-selected', 'true')
    unmount()
    renderAt('/profil?section=abonnement')
    expect(tab('Mon profil')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Profil patient — cas particuliers', () => {
  it("dit quand les notifications ne sont pas disponibles, ou en cours de chargement", () => {
    setup({ push: { supported: false, subscribed: false } })
    const { unmount } = renderAt('/profil?section=notifications')
    expect(screen.getByText(/ne sont pas disponibles sur cet appareil/)).toBeInTheDocument()
    unmount()
    setup({ push: undefined })
    renderAt('/profil?section=notifications')
    expect(screen.getByText('Chargement...')).toBeInTheDocument()
  })

  it("bloque la suppression du compte tant qu'un abonnement est en cours", () => {
    setup({ subscriptions: [{ status: 'active', current_period_end: null, cancel_at_period_end: false }] })
    renderAt('/profil?section=donnees')
    expect(screen.getByText(/Vous avez un abonnement en cours/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer mon compte' })).toBeDisabled()
  })

  it("un administrateur est annoncé comme tel", () => {
    setup({ isAdmin: true })
    renderAt()
    expect(screen.getByText('Administrateur')).toBeInTheDocument()
  })

  it("un praticien qui ouvre /profil garde ses informations professionnelles, sans jauge de propriétaire", () => {
    setup({ role: 'doctor' })
    renderAt()
    expect(screen.getByText('Vétérinaire')).toBeInTheDocument()
    expect(screen.getByText('✓ Vérifié')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/Informations professionnelles/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Enregistrer mes informations' })).toHaveLength(1)
  })
})
