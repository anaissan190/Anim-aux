// Test de fumée des onglets « Mon cabinet » et « Profil » du tableau de bord praticien : on affiche
// vraiment la page (données fournies à la place de Supabase) et on vérifie que chaque sous-onglet
// contient ce qu'il doit, que le créateur du cabinet voit plus qu'un simple membre, et qu'un seul
// bouton « Enregistrer » couvre tout le profil.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({
  overrides: {} as Record<string, () => unknown>,
  mutateAsync: vi.fn(),
  updateProfile: vi.fn(),
  updateDoctor: vi.fn(),
}))

vi.mock('@/hooks/useData', () => new Proxy({}, {
  // Vitest vérifie qu'un export existe avant de le lire : on dit « oui » pour tous les hooks.
  has: () => true,
  get: (_t, name: string) => {
    if (name === '__esModule') return true
    if (name === 'then') return undefined
    if (name === 'useUpdateProfile') return () => ({ mutateAsync: h.updateProfile, mutate: vi.fn(), isPending: false })
    if (name === 'useUpdateDoctor') return () => ({ mutateAsync: h.updateDoctor, mutate: vi.fn(), isPending: false })
    return () => (h.overrides[name]?.() ?? { data: undefined, isLoading: false, isSuccess: true, error: null, mutate: vi.fn(), mutateAsync: h.mutateAsync, isPending: false })
  },
}))
vi.mock('@/components/ui/Navbar', () => ({ default: () => null }))
vi.mock('@/components/ui/PushNotificationBanner', () => ({ default: () => null }))
vi.mock('@/components/mobile/DoctorMobileTabBar', () => ({ default: () => null }))
vi.mock('@/components/appointment/AppointmentCard', () => ({ default: () => null }))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: ({ value }: { value: string }) => <div data-testid="bio-editor">{value}</div> }))
vi.mock('@/components/doctor/PractitionerTypePicker', () => ({ default: () => <div data-testid="type-picker" /> }))

import { useAuthStore } from '@/lib/authStore'
import DoctorDashboard from './DoctorDashboard'

const profileRow = { first_name: 'Léa', last_name: 'Martin', avatar_url: null, phone: '06 12 34 56 78' }
const doctor = {
  id: 'd1', user_id: 'u1', specialties: ['Vétérinaire'], bio: '<p>Vétérinaire canin et félin depuis dix ans à Lyon.</p>',
  verification_status: 'verified', is_listed: true, accepted_species: ['Chien'], home_visit: false, messaging_enabled: true,
  consultation_price: 50, address: '12 rue des Lilas', city: 'Lyon', plan: 'pro',
  profiles: profileRow,
}
const clinic = { id: 'c1', name: 'Clinique des Lilas', city: 'Lyon', address: '12 rue des Lilas', phone: '0400000000', logo_url: null, invite_code: 'AB7K9Q2M', owner_id: 'u1', plan: 'cabinet', max_practitioners: null }
const member = (id: string, doctorId: string, userId: string, first: string, last: string, price: number) => ({
  id, doctor_id: doctorId,
  doctors: { id: doctorId, user_id: userId, specialties: ['Vétérinaire'], consultation_price: price, profiles: { first_name: first, last_name: last, avatar_url: null } },
})
const members = [member('m1', 'd1', 'u1', 'Léa', 'Martin', 50), member('m2', 'd2', 'u2', 'Karim', 'Ben', 80)]
const recent = new Date(); recent.setDate(recent.getDate() - 2)
const appt = (doctor_id: string, status: string) => ({ id: `${doctor_id}-${status}`, patient_id: 'p1', doctor_id, start_at: recent.toISOString(), end_at: recent.toISOString(), status, reason: 'Vaccin', animals: [], patientProfile: null })

function setup(over: { owner?: boolean; hasPro?: boolean } = {}) {
  const owner = over.owner ?? true
  h.overrides = {
    useCurrentDoctor: () => ({ data: doctor, isLoading: false }),
    useDoctorHasPro: () => ({ data: over.hasPro ?? true }),
    useMyClinic: () => ({ data: { ...clinic, owner_id: owner ? 'u1' : 'u9' }, isLoading: false }),
    useClinicMembers: () => ({ data: members }),
    useClinicAppointments: () => ({ data: [appt('d1', 'completed'), appt('d2', 'completed'), appt('d2', 'confirmed')] }),
    useClinicAvailabilities: () => ({ data: [] }),
    useClinicStaffList: () => ({ data: [{ id: 's1', user_id: 's1', email: 'alice@exemple.fr', first_name: 'Alice' }] }),
    useClinicReviews: () => ({ data: [{ doctor_id: 'd1', rating: 5, created_at: recent.toISOString(), doctor_reply: null }] }),
    useDoctorVerificationDocuments: () => ({ data: [{ id: 'v1', document_type: 'Diplôme', file_name: 'diplome.pdf', file_url: 'x' }] }),
    useMySubscriptions: () => ({ data: [] }),
  }
  useAuthStore.setState({ user: { id: 'u1', email: 'lea@exemple.fr', role: 'doctor', is_admin: false, created_at: '' } as any, profile: profileRow as any, loading: false })
}

const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><DoctorDashboard /></MemoryRouter>)
const tab = (name: RegExp | string) => screen.getByRole('tab', { name })

beforeEach(() => {
  vi.clearAllMocks()
  h.mutateAsync.mockResolvedValue(undefined)
  h.updateProfile.mockResolvedValue(undefined)
  h.updateDoctor.mockResolvedValue(undefined)
})

describe('Mon cabinet — créateur', () => {
  beforeEach(() => setup())

  it("affiche l'en-tête du cabinet et cinq sous-onglets, sur la vue d'ensemble", () => {
    renderAt('/dashboard/doctor?tab=cabinet')
    expect(screen.getByRole('heading', { name: 'Clinique des Lilas' })).toBeInTheDocument()
    const names = within(screen.getByRole('tablist', { name: 'Sections du cabinet' })).getAllByRole('tab').map(t => t.textContent)
    expect(names).toEqual(["Vue d'ensemble", 'Équipe2', 'Secrétariat1', 'Réglages', 'Statistiques'])
    expect(tab("Vue d'ensemble")).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText("Activité de l'équipe ce mois-ci")).toBeInTheDocument()
    expect(screen.getByText('À regarder')).toBeInTheDocument()
    expect(screen.getByText('AB7K9Q2M')).toBeInTheDocument()
  })

  it("« Équipe » montre une carte par praticien, avec ses chiffres, et la possibilité de retirer un confrère", () => {
    renderAt('/dashboard/doctor?tab=cabinet')
    fireEvent.click(tab(/Équipe/))
    expect(screen.getByText('Équipe (2)')).toBeInTheDocument()
    expect(screen.getByText('Léa Martin')).toBeInTheDocument()
    expect(screen.getByText('Karim Ben')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer' })).toBeInTheDocument()
    expect(screen.getAllByText(/1 RDV ce mois/).length).toBe(2)
    expect(screen.getByText(/80 €/)).toBeInTheDocument()
  })

  it("« Statistiques » montre les statistiques du cabinet, avec le comparatif", () => {
    renderAt('/dashboard/doctor?tab=cabinet')
    fireEvent.click(tab('Statistiques'))
    expect(screen.getByText('Statistiques du cabinet')).toBeInTheDocument()
    expect(screen.getByText('Comparatif des praticiens')).toBeInTheDocument()
  })

  it("« Secrétariat » et « Réglages » regroupent le secrétariat, le profil du cabinet et la zone dangereuse", () => {
    renderAt('/dashboard/doctor?tab=cabinet')
    fireEvent.click(tab(/Secrétariat/))
    expect(screen.getByRole('heading', { name: 'Secrétariat' })).toBeInTheDocument()
    expect(screen.queryByText('Zone dangereuse')).not.toBeInTheDocument()
    fireEvent.click(tab('Réglages'))
    expect(screen.getByText('Profil du cabinet')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom du cabinet')).toHaveValue('Clinique des Lilas')
    expect(screen.getByText('Zone dangereuse')).toBeInTheDocument()
    expect(screen.queryByText("Activité de l'équipe ce mois-ci")).not.toBeInTheDocument()
  })

  it("s'ouvre directement sur la section demandée par l'adresse", () => {
    renderAt('/dashboard/doctor?tab=cabinet&section=reglages')
    expect(tab('Réglages')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Zone dangereuse')).toBeInTheDocument()
  })
})

describe('Mon cabinet — simple membre', () => {
  beforeEach(() => setup({ owner: false }))

  it("n'a que trois sous-onglets et aucun revenu ni activité des confrères", () => {
    renderAt('/dashboard/doctor?tab=cabinet')
    const names = within(screen.getByRole('tablist', { name: 'Sections du cabinet' })).getAllByRole('tab').map(t => t.textContent)
    expect(names).toEqual(["Vue d'ensemble", 'Équipe2', 'Statistiques'])
    expect(screen.queryByText('Revenu estimé')).not.toBeInTheDocument()
    expect(screen.queryByText("Activité de l'équipe ce mois-ci")).not.toBeInTheDocument()
  })

  it("se voit refuser les sections du créateur, même par l'adresse", () => {
    renderAt('/dashboard/doctor?tab=cabinet&section=reglages')
    expect(tab("Vue d'ensemble")).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Zone dangereuse')).not.toBeInTheDocument()
    fireEvent.click(tab(/Équipe/))
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument()
  })
})

describe('Profil', () => {
  beforeEach(() => setup())

  it("affiche l'en-tête de synthèse et quatre sous-onglets, sur « Mon profil »", () => {
    renderAt('/dashboard/doctor?tab=profil')
    expect(screen.getByText('Léa Martin')).toBeInTheDocument()
    expect(screen.getByText('✓ Vérifié')).toBeInTheDocument()
    expect(screen.getByText('Abonnement cabinet')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Profil complété' })).toBeInTheDocument()
    const names = within(screen.getByRole('tablist', { name: 'Sections du profil' })).getAllByRole('tab').map(t => t.textContent)
    expect(names).toEqual(['Mon profil', 'Abonnement et vérification', 'Notifications et agenda', 'Données et compte'])
    for (const title of ['Identité', 'Présentation', 'Coordonnées', 'Ce que voient les patients']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it("range visibilité, messagerie et domicile en interrupteurs dans « Mon profil »", () => {
    renderAt('/dashboard/doctor?tab=profil')
    expect(screen.getByRole('switch', { name: /Apparaître dans la recherche/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /Recevoir des messages/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /à domicile/ })).toHaveAttribute('aria-checked', 'false')
  })

  it("n'a qu'UN bouton « Enregistrer », tout en bas, après les interrupteurs et les espèces", () => {
    renderAt('/dashboard/doctor?tab=profil')
    const saves = screen.getAllByRole('button', { name: 'Enregistrer mes informations' })
    expect(saves).toHaveLength(1)
    const lastSwitch = screen.getByRole('switch', { name: /à domicile/ })
    const species = screen.getByRole('button', { name: /Chien/ })
    for (const el of [lastSwitch, species, screen.getByTestId('bio-editor'), screen.getByLabelText('Prénom')]) {
      expect(el.compareDocumentPosition(saves[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it("enregistre d'un coup les champs ET les interrupteurs modifiés", async () => {
    renderAt('/dashboard/doctor?tab=profil')
    fireEvent.click(screen.getByRole('switch', { name: /Apparaître dans la recherche/ }))
    fireEvent.click(screen.getByRole('switch', { name: /à domicile/ }))
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Léa-Marie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))
    await waitFor(() => expect(h.updateDoctor).toHaveBeenCalled())
    expect(h.updateProfile.mock.calls[0][0]).toMatchObject({ first_name: 'Léa-Marie' })
    expect(h.updateDoctor.mock.calls[0][0]).toMatchObject({ is_listed: false, home_visit: true })
    expect(await screen.findByText('✓ Informations enregistrées.')).toBeInTheDocument()
  })

  it("garde les modifications non enregistrées en passant d'un sous-onglet à l'autre", () => {
    renderAt('/dashboard/doctor?tab=profil')
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Léa-Marie' } })
    fireEvent.click(tab('Données et compte'))
    fireEvent.click(tab('Mon profil'))
    expect(screen.getByLabelText('Prénom')).toHaveValue('Léa-Marie')
  })

  it("range abonnement, vérification, notifications, agenda et données dans leurs sous-onglets", () => {
    renderAt('/dashboard/doctor?tab=profil')
    expect(screen.queryByText('Mon abonnement')).not.toBeInTheDocument()
    fireEvent.click(tab('Abonnement et vérification'))
    expect(screen.getByText('Mon abonnement')).toBeInTheDocument()
    expect(screen.getByText('Vérification de mon profil')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Identité' })).not.toBeInTheDocument()
    fireEvent.click(tab('Notifications et agenda'))
    expect(screen.getByText(/Synchroniser mon agenda/)).toBeInTheDocument()
    fireEvent.click(tab('Données et compte'))
    expect(screen.getByText('Mes données')).toBeInTheDocument()
    expect(screen.getByText('Zone de danger')).toBeInTheDocument()
  })

  it("s'ouvre directement sur la section demandée par l'adresse", () => {
    renderAt('/dashboard/doctor?tab=profil&section=abonnement')
    expect(tab('Abonnement et vérification')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Mon abonnement')).toBeInTheDocument()
  })

  it("une section inconnue dans l'adresse ouvre « Mon profil »", () => {
    renderAt('/dashboard/doctor?tab=profil&section=nimporte')
    expect(tab('Mon profil')).toHaveAttribute('aria-selected', 'true')
  })
})
