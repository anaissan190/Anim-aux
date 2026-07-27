import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import AvailabilityCalendar from './AvailabilityCalendar'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Une seule disponibilité 09:00-10:00 par 30 min, quel que soit le jour
// demandé — le mock ne simule pas le filtre .eq('day_of_week', ...), donc
// pas besoin de calculer le vrai jour de la semaine du jour cliqué.
const FAKE_AVAILABILITY = [
  { id: 'a1', doctor_id: 'doc-1', day_of_week: 0, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 30, is_active: true },
]

function mockSupabaseForSlots({ availabilities = FAKE_AVAILABILITY, booked = [] as { start_at: string }[], blocked = [] as { start_at: string; end_at: string }[] } = {}) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'availabilities') return createQueryBuilderMock({ data: availabilities, error: null })
    if (table === 'blocked_slots') return createQueryBuilderMock({ data: blocked, error: null })
    return createQueryBuilderMock({ data: [], error: null })
  })
  vi.mocked(supabase.rpc).mockResolvedValue({ data: booked, error: null } as any)
}

// La dernière colonne de la semaine (aujourd'hui + 6 jours) : toujours
// suffisamment loin dans le futur pour ne jamais être exclue par le délai
// de battement de 15 minutes (generateAvailableSlots), quelle que soit
// l'heure à laquelle le test tourne.
function clickLastDayOfWeek(container: HTMLElement) {
  const dayButtons = container.querySelector('.grid-cols-7')!.querySelectorAll('button')
  fireEvent.click(dayButtons[dayButtons.length - 1])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AvailabilityCalendar', () => {
  it('n\'affiche aucun créneau tant qu\'aucun jour n\'est sélectionné', () => {
    mockSupabaseForSlots()
    render(<AvailabilityCalendar doctorId="doc-1" selected={null} onSelect={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Aucun créneau disponible ce jour')).not.toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalledWith('availabilities')
  })

  it('affiche un message si le praticien n\'a aucune disponibilité ce jour-là', async () => {
    mockSupabaseForSlots({ availabilities: [] })
    const { container } = render(<AvailabilityCalendar doctorId="doc-1" selected={null} onSelect={vi.fn()} />, { wrapper })

    clickLastDayOfWeek(container)

    await waitFor(() => expect(screen.getByText('Aucun créneau disponible ce jour')).toBeInTheDocument())
  })

  it('affiche les créneaux disponibles et déclenche onSelect au clic', async () => {
    mockSupabaseForSlots()
    const onSelect = vi.fn()
    const { container } = render(<AvailabilityCalendar doctorId="doc-1" selected={null} onSelect={onSelect} />, { wrapper })

    clickLastDayOfWeek(container)

    const slotButton = await screen.findByText('09:00')
    fireEvent.click(slotButton)

    expect(onSelect).toHaveBeenCalledTimes(1)
    const calledWith = onSelect.mock.calls[0][0] as Date
    expect(calledWith.getHours()).toBe(9)
    expect(calledWith.getMinutes()).toBe(0)
  })

  it('exclut un créneau déjà réservé', async () => {
    // get_booked_slots renvoie le créneau de 9h comme déjà pris : seul 9h30
    // doit rester proposé.
    const dayButtons7Away = new Date()
    dayButtons7Away.setDate(dayButtons7Away.getDate() + 6)
    dayButtons7Away.setHours(9, 0, 0, 0)
    mockSupabaseForSlots({ booked: [{ start_at: dayButtons7Away.toISOString() }] })

    const { container } = render(<AvailabilityCalendar doctorId="doc-1" selected={null} onSelect={vi.fn()} />, { wrapper })
    clickLastDayOfWeek(container)

    await screen.findByText('09:30')
    expect(screen.queryByText('09:00')).not.toBeInTheDocument()
  })

  it('re-sélectionner le même jour désélectionne et masque les créneaux', async () => {
    mockSupabaseForSlots()
    const { container } = render(<AvailabilityCalendar doctorId="doc-1" selected={null} onSelect={vi.fn()} />, { wrapper })

    clickLastDayOfWeek(container)
    await screen.findByText('09:00')

    clickLastDayOfWeek(container) // même jour → toggle off
    expect(screen.queryByText('09:00')).not.toBeInTheDocument()
    expect(screen.queryByText('Aucun créneau disponible ce jour')).not.toBeInTheDocument()
  })
})
