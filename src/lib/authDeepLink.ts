// src/lib/authDeepLink.ts
// Lecture des liens d'email (confirmation d'inscription, mot de passe oublié)
// qui rouvrent l'application : fr.monanimeaux.app://reset-password#access_token=…
// Fonction pure, testée (authDeepLink.test.ts).
import { NATIVE_SCHEME } from '@/lib/nativeApp'

export type AuthFlow = 'recovery' | 'signup'

export type AuthDeepLink =
  | { kind: 'session'; flow: AuthFlow; accessToken: string; refreshToken: string }
  | { kind: 'error'; flow: AuthFlow; message: string }

export function parseAuthDeepLink(url: string): AuthDeepLink | null {
  if (!url.startsWith(NATIVE_SCHEME)) return null

  const rest = url.slice(NATIVE_SCHEME.length)
  const cut = rest.search(/[?#]/)
  const path = cut === -1 ? rest : rest.slice(0, cut)
  const tail = cut === -1 ? '' : rest.slice(cut + 1)
  // Supabase place les paramètres après « # » ; on accepte aussi « ? ».
  const params = new URLSearchParams(tail.replace('#', '&'))

  const flow: AuthFlow = params.get('type') === 'recovery' || path.startsWith('reset-password') ? 'recovery' : 'signup'

  if (params.get('error') || params.get('error_code') || params.get('error_description')) {
    const message = params.get('error_code') === 'otp_expired'
      ? 'Ce lien a expiré. Demandez-en un nouveau.'
      : "Ce lien n'est plus valide. Demandez-en un nouveau."
    return { kind: 'error', flow, message }
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) return { kind: 'session', flow, accessToken, refreshToken }
  return null
}
