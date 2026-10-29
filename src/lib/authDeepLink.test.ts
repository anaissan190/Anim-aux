import { describe, it, expect } from 'vitest'
import { parseAuthDeepLink } from '@/lib/authDeepLink'
import { authRedirectUrl } from '@/lib/nativeApp'

describe('parseAuthDeepLink', () => {
  it('lit la session d\'un lien de réinitialisation de mot de passe', () => {
    expect(parseAuthDeepLink('fr.monanimeaux.app://reset-password#access_token=AAA&refresh_token=BBB&type=recovery'))
      .toEqual({ kind: 'session', flow: 'recovery', accessToken: 'AAA', refreshToken: 'BBB' })
  })

  it('lit la session d\'un lien de confirmation d\'inscription', () => {
    expect(parseAuthDeepLink('fr.monanimeaux.app://auth#access_token=AAA&refresh_token=BBB&type=signup'))
      .toEqual({ kind: 'session', flow: 'signup', accessToken: 'AAA', refreshToken: 'BBB' })
  })

  it('signale un lien expiré', () => {
    expect(parseAuthDeepLink('fr.monanimeaux.app://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'))
      .toEqual({ kind: 'error', flow: 'recovery', message: 'Ce lien a expiré. Demandez-en un nouveau.' })
  })

  it('signale un autre lien invalide', () => {
    const r = parseAuthDeepLink('fr.monanimeaux.app://auth#error=access_denied')
    expect(r).toEqual({ kind: 'error', flow: 'signup', message: "Ce lien n'est plus valide. Demandez-en un nouveau." })
  })

  it('ignore ce qui n\'est pas un lien de l\'application ou n\'a pas de jeton', () => {
    expect(parseAuthDeepLink('https://monanimeaux.fr/reset-password#access_token=AAA&refresh_token=BBB')).toBeNull()
    expect(parseAuthDeepLink('fr.monanimeaux.app://auth')).toBeNull()
    expect(parseAuthDeepLink('fr.monanimeaux.app://auth#access_token=AAA')).toBeNull()
  })
})

describe('authRedirectUrl', () => {
  it('garde l\'adresse du site sur le web', () => {
    expect(authRedirectUrl('/reset-password', false)).toBe(`${window.location.origin}/reset-password`)
  })
  it('utilise le schéma de l\'application dans l\'application', () => {
    expect(authRedirectUrl('/reset-password', true)).toBe('fr.monanimeaux.app://reset-password')
    expect(authRedirectUrl('/auth', true)).toBe('fr.monanimeaux.app://auth')
  })
})
