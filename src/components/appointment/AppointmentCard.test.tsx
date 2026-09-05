import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import AppointmentCard from './AppointmentCard'

function baseAppointment(overrides: Record<string, any> = {}): any {
  const future = new Date(); future.setDate(future.getDate() + 5)
  const futureEnd = new Date(future); futureEnd.setMinutes(futureEnd.getMinutes() + 30)
  return {
    id: 'appt-1', doctor_id: 'doc-1', patient_id: 'patient-1',
    start_at: future.toISOString(), end_at: futureEnd.toISOString(), status: 'confirmed', reason: null,
    profiles: { first_name: 'Anaïs', last_name: 'S' },
    doctors: { specialty: 'Vétérinaire', profiles: { first_name: 'Jean', last_name: 'Dupont' } },
    animals: [],
    ...overrides,
  }
}

function renderCard(props: any, updateBuilder?: ReturnType<typeof createQueryBuilderMock>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const documentsBuilder = createQueryBuilderMock({ data: [], error: null })
  // useAppointmentDocuments (query) et useUpdateAppointmentStatus (mutation)
  // appellent tous deux supabase.from('appointments'/'appointment_documents') —
  // on distingue par appel : le premier .from() de chaque rendu sert aux
  // documents, un builder dédié est fourni pour vérifier l'update le cas échéant.
  vi.mocked(supabase.from).mockImplementation(() => updateBuilder ?? documentsBuilder)
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AppointmentCard {...props} /></MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, loading: false })
})

describe('AppointmentCard — affichage', () => {
  it('affiche le nom du praticien côté patient (showPatient=false)', () => {
    renderCard({ appointment: baseAppointment() })
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
  })

  it('affiche le nom du patient côté praticien (showPatient=true)', () => {
    renderCard({ appointment: baseAppointment(), showPatient: true })
    expect(screen.getByText('Anaïs S')).toBeInTheDocument()
  })

  it('affiche le motif si renseigné', () => {
    renderCard({ appointment: baseAppointment({ reason: 'Vaccination' }) })
    expect(screen.getByText(/Vaccination/)).toBeInTheDocument()
  })

  it("n'affiche pas l'année pour un RDV de l'année en cours", () => {
    renderCard({ appointment: baseAppointment() })
    expect(screen.queryByText(String(new Date().getFullYear()))).not.toBeInTheDocument()
  })

  it("affiche l'année pour un RDV d'une année passée (ambiguïté mois+jour)", () => {
    const pastYear = baseAppointment({ status: 'completed', start_at: new Date('2020-03-15').toISOString() })
    renderCard({ appointment: pastYear })
    expect(screen.getByText('2020')).toBeInTheDocument()
  })

  it('propose de laisser un avis uniquement côté patient (pas côté praticien)', () => {
    const { rerender } = renderCard({ appointment: baseAppointment(), showPatient: false })
    expect(screen.getByText(/Laisser un avis/)).toBeInTheDocument()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><AppointmentCard appointment={baseAppointment()} showPatient /></MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.queryByText(/Laisser un avis/)).not.toBeInTheDocument()
  })

  it('affiche le lien vers le dossier animal seulement pour un RDV confirmé/terminé avec animaux', () => {
    const withAnimal = baseAppointment({ status: 'confirmed', animals: [{ id: 'a1', name: 'Rex' }] })
    renderCard({ appointment: withAnimal, showPatient: true })
    expect(screen.getByText(/Dossier de Rex/)).toBeInTheDocument()
  })

  it('n\'affiche pas le lien dossier animal pour un RDV en attente', () => {
    const pending = baseAppointment({ status: 'pending', animals: [{ id: 'a1', name: 'Rex' }] })
    renderCard({ appointment: pending, showPatient: true })
    expect(screen.queryByText(/Dossier de Rex/)).not.toBeInTheDocument()
  })
})

describe('AppointmentCard — export calendrier (.ics)', () => {
  it('propose "Ajouter à mon calendrier" pour un RDV confirmé', () => {
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    expect(screen.getByText(/Ajouter à mon calendrier/)).toBeInTheDocument()
  })

  it('ne le propose pas pour un RDV en attente ou annulé', () => {
    renderCard({ appointment: baseAppointment({ status: 'pending' }) })
    expect(screen.queryByText(/Ajouter à mon calendrier/)).not.toBeInTheDocument()
  })

  it('déclenche le téléchargement du fichier .ics au clic', () => {
    // jsdom n'implémente pas URL.createObjectURL/revokeObjectURL — on les
    // stub pour vérifier que le composant déclenche bien un téléchargement,
    // sans dépendre du contenu réel du Blob (couvert par ics.test.ts).
    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    fireEvent.click(screen.getByText(/Ajouter à mon calendrier/))

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

describe('AppointmentCard — annulation patient', () => {
  it('permet d\'annuler un RDV futur en attente ou confirmé', () => {
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    expect(screen.getByText('Annuler')).toBeInTheDocument()
  })

  it('ne permet pas d\'annuler un RDV déjà passé', () => {
    const past = baseAppointment({ status: 'confirmed', start_at: new Date('2020-01-01').toISOString() })
    renderCard({ appointment: past })
    expect(screen.queryByText('Annuler')).not.toBeInTheDocument()
  })

  it('ne permet pas d\'annuler un RDV déjà terminé', () => {
    renderCard({ appointment: baseAppointment({ status: 'completed' }) })
    expect(screen.queryByText('Annuler')).not.toBeInTheDocument()
  })

  it('déclenche la mise à jour du statut à "cancelled" au clic', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) }, builder)
    fireEvent.click(screen.getByText('Annuler'))
    await waitFor(() => expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' })))
  })
})

describe('AppointmentCard — report patient', () => {
  it('propose un bouton "Reporter" pour un RDV confirmé', () => {
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    expect(screen.getByText('Reporter')).toBeInTheDocument()
  })

  it('ne propose pas "Reporter" sur un RDV en attente (pas encore confirmé)', () => {
    renderCard({ appointment: baseAppointment({ status: 'pending' }) })
    expect(screen.queryByText('Reporter')).not.toBeInTheDocument()
  })

  it('ne propose pas "Reporter" pour un RDV déjà passé', () => {
    const past = baseAppointment({ status: 'confirmed', start_at: new Date('2020-01-01').toISOString() })
    renderCard({ appointment: past })
    expect(screen.queryByText('Reporter')).not.toBeInTheDocument()
  })

  it('ne propose pas "Reporter" à moins de 24h du RDV (même délai que la policy RLS)', () => {
    const soon = new Date(Date.now() + 6 * 60 * 60 * 1000) // dans 6h
    renderCard({ appointment: baseAppointment({ status: 'confirmed', start_at: soon.toISOString() }) })
    expect(screen.queryByText('Reporter')).not.toBeInTheDocument()
    // L'annulation, elle, reste possible sans ce délai.
    expect(screen.getByText('Annuler')).toBeInTheDocument()
  })

  it('ne propose pas "Reporter" pour un RDV déjà terminé', () => {
    renderCard({ appointment: baseAppointment({ status: 'completed' }) })
    expect(screen.queryByText('Reporter')).not.toBeInTheDocument()
  })

  it('affiche le calendrier de créneaux au clic sur "Reporter"', () => {
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    fireEvent.click(screen.getByText('Reporter'))
    expect(screen.getByText('Choisir un nouveau créneau')).toBeInTheDocument()
    expect(screen.getByText('Annuler le report')).toBeInTheDocument()
  })
})

describe('AppointmentCard — actions praticien', () => {
  const FAKE_DOCTOR = { id: 'doc-user-1', email: 'a@a.fr', role: 'doctor' as const, is_admin: false, created_at: '' }

  it('propose Confirmer/Refuser pour un RDV en attente', () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    renderCard({ appointment: baseAppointment({ status: 'pending' }) })
    expect(screen.getByText('Confirmer')).toBeInTheDocument()
    expect(screen.getByText('Refuser')).toBeInTheDocument()
  })

  it('propose Terminé/Absent(e) pour un RDV confirmé', () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    expect(screen.getByText('✓ Terminé')).toBeInTheDocument()
    expect(screen.getByText('Absent(e)')).toBeInTheDocument()
  })

  it('ne montre pas le bouton "Annuler" générique du patient sur un RDV en attente (redondant avec Confirmer/Refuser)', () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    renderCard({ appointment: baseAppointment({ status: 'pending' }) })
    expect(screen.queryByText('Annuler')).not.toBeInTheDocument()
  })

  it('propose un bouton "Annuler" dédié pour un RDV confirmé (avec confirmation)', () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    expect(screen.getByText('Annuler')).toBeInTheDocument()
  })

  it('propose un bouton "Reporter" pour un RDV confirmé', () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) })
    expect(screen.getByText('Reporter')).toBeInTheDocument()
  })

  it('ne montre pas le bouton "Reporter" sur un RDV en attente', () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    renderCard({ appointment: baseAppointment({ status: 'pending' }) })
    expect(screen.queryByText('Reporter')).not.toBeInTheDocument()
  })

  it('ne montre aucune action praticien pour un patient connecté', () => {
    useAuthStore.setState({ user: { id: 'patient-1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' } })
    renderCard({ appointment: baseAppointment({ status: 'pending' }) })
    expect(screen.queryByText('Confirmer')).not.toBeInTheDocument()
  })

  it('marque le RDV comme terminé au clic', async () => {
    useAuthStore.setState({ user: FAKE_DOCTOR })
    const builder = createQueryBuilderMock({ data: null, error: null })
    renderCard({ appointment: baseAppointment({ status: 'confirmed' }) }, builder)
    fireEvent.click(screen.getByText('✓ Terminé'))
    await waitFor(() => expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' })))
  })
})
