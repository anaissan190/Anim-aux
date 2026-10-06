import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createSupabaseMock } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => ({
  supabase: createSupabaseMock(),
  getMyUserDataWithRetry: vi.fn(),
}))
// Le vrai widget charge un script Cloudflare : on le remplace par un faux qui
// "réussit" immédiatement et renvoie un jeton différent à chaque montage.
let tokenCounter = 0
vi.mock('@/components/ui/Turnstile', async () => {
  const { useEffect } = await import('react')
  return {
    default: ({ onVerify }: { onVerify: (t: string) => void }) => {
      useEffect(() => { onVerify(`jeton-${++tokenCounter}`) }, [])
      return null
    },
  }
})

import { supabase } from '@/lib/supabase'
import LoginPage from './LoginPage'

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

async function submitLogin() {
  fireEvent.change(screen.getByPlaceholderText('vous@email.fr'), { target: { value: 'nouveau@exemple.fr' } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'motdepasse1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  tokenCounter = 0
})

describe('LoginPage — renvoi de l\'email de confirmation', () => {
  it('propose de renvoyer l\'email quand le compte n\'est pas confirmé, puis le renvoie avec un jeton captcha', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } } as any)
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: {}, error: null } as any)
    renderLogin()

    await submitLogin()
    const resendButton = await screen.findByRole('button', { name: "Renvoyer l'email de confirmation" })
    await waitFor(() => expect(resendButton).not.toBeDisabled())
    fireEvent.click(resendButton)

    await waitFor(() => expect(supabase.auth.resend).toHaveBeenCalledTimes(1))
    const args = vi.mocked(supabase.auth.resend).mock.calls[0][0] as any
    expect(args.type).toBe('signup')
    expect(args.email).toBe('nouveau@exemple.fr')
    expect(args.options.captchaToken).toMatch(/^jeton-/)
    expect(await screen.findByText(/nouvel email de confirmation vient d'être envoyé/)).toBeTruthy()
  })

  it("n'affiche pas le bouton pour une simple erreur de mot de passe", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } } as any)
    renderLogin()
    await submitLogin()
    await screen.findByText('Email ou mot de passe incorrect')
    expect(screen.queryByRole('button', { name: "Renvoyer l'email de confirmation" })).toBeNull()
  })

  it('explique la limite de débit si Supabase refuse le renvoi', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } } as any)
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: null, error: { code: 'over_email_send_rate_limit', message: 'rate limit' } } as any)
    renderLogin()
    await submitLogin()
    const resendButton = await screen.findByRole('button', { name: "Renvoyer l'email de confirmation" })
    await waitFor(() => expect(resendButton).not.toBeDisabled())
    fireEvent.click(resendButton)
    expect(await screen.findByText(/patientez une minute/)).toBeTruthy()
  })
})
