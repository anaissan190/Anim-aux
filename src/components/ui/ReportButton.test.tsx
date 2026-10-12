import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

import { supabase } from '@/lib/supabase'
import ReportButton from './ReportButton'

function renderButton(props: Partial<React.ComponentProps<typeof ReportButton>> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReportButton targetType="review" targetId="rev-1" label="Signaler cet avis" {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => { vi.clearAllMocks() })

describe('ReportButton', () => {
  it("n'envoie rien tant que le motif est vide", () => {
    renderButton()
    fireEvent.click(screen.getByText(/Signaler cet avis/))
    expect(screen.getByText('Envoyer le signalement')).toBeDisabled()
  })

  it('envoie le signalement de l\'avis avec le motif saisi', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    renderButton({ placeholder: 'Pourquoi cet avis est-il abusif ?' })

    fireEvent.click(screen.getByText(/Signaler cet avis/))
    fireEvent.change(screen.getByPlaceholderText('Pourquoi cet avis est-il abusif ?'), { target: { value: '  Propos injurieux  ' } })
    fireEvent.click(screen.getByText('Envoyer le signalement'))

    await waitFor(() => expect(screen.getByText(/Signalement envoyé/)).toBeInTheDocument())
    expect(supabase.rpc).toHaveBeenCalledWith('create_report', {
      p_target_type: 'review', p_target_id: 'rev-1', p_reason: 'Propos injurieux',
    })
  })

  it("affiche l'erreur de la base (ex. avis d'un autre praticien) sans fermer le formulaire", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Seul le praticien concerné peut signaler cet avis' } } as any)
    renderButton()

    fireEvent.click(screen.getByText(/Signaler cet avis/))
    fireEvent.change(screen.getByPlaceholderText(/Expliquez/), { target: { value: 'abusif' } })
    fireEvent.click(screen.getByText('Envoyer le signalement'))

    await waitFor(() => expect(screen.getByText(/Seul le praticien concerné/)).toBeInTheDocument())
    expect(screen.getByText('Envoyer le signalement')).toBeInTheDocument()
  })
})
