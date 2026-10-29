import { describe, it, expect } from 'vitest'
import { parseAuthDeepLink } from '@/lib/authDeepLink'
import { authRedirectUrl, isMobileBrowser, openInAppUrl, shouldOfferOpenInApp } from '@/lib/nativeApp'

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
  it('renvoie vers une page du site, marquée « venue de l\'application », dans l\'application', () => {
    expect(authRedirectUrl('/reset-password', true)).toBe('https://monanimeaux.fr/reset-password?from=app')
    expect(authRedirectUrl('/auth/confirm', true)).toBe('https://monanimeaux.fr/auth/confirm?from=app')
  })
})

describe('shouldOfferOpenInApp', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
  const base = { search: '?from=app', hash: '#access_token=A&refresh_token=B&type=signup', userAgent: iphone, native: false }

  it('propose d\'ouvrir l\'application sur un téléphone, pour un lien venu de l\'application', () => {
    expect(shouldOfferOpenInApp(base)).toBe(true)
  })
  it('propose aussi pour un lien expiré, pour que l\'application affiche le message', () => {
    expect(shouldOfferOpenInApp({ ...base, hash: '#error=access_denied&error_code=otp_expired' })).toBe(true)
  })
  it('ne propose rien sur ordinateur', () => {
    expect(shouldOfferOpenInApp({ ...base, userAgent: mac })).toBe(false)
  })
  it('ne propose rien pour une inscription faite sur le site', () => {
    expect(shouldOfferOpenInApp({ ...base, search: '' })).toBe(false)
  })
  it('ne propose rien sans jeton dans le lien, ni dans l\'application elle-même', () => {
    expect(shouldOfferOpenInApp({ ...base, hash: '' })).toBe(false)
    expect(shouldOfferOpenInApp({ ...base, native: true })).toBe(false)
  })
})

describe('openInAppUrl', () => {
  it('reporte les jetons du lien d\'email vers le schéma de l\'application', () => {
    expect(openInAppUrl('reset-password', '#access_token=A')).toBe('fr.monanimeaux.app://reset-password#access_token=A')
  })
  it('reconnaît les navigateurs de téléphone', () => {
    expect(isMobileBrowser('Mozilla/5.0 (Linux; Android 14)')).toBe(true)
    expect(isMobileBrowser('Mozilla/5.0 (Macintosh)')).toBe(false)
  })
})
