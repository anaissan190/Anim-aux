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
  return {
    id: 'appt-1', doctor_id: 'doc-1', patient_id: 'patient-1',
    start_at: future.toISOString(), status: 'confirmed', reason: null,
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
