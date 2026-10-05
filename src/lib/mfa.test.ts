import { describe, it, expect } from 'vitest'
import { pickVerifiedTotpFactor, isMfaChallengeRequired, normalizeTotpCode, isValidTotpCode } from './mfa'

describe('pickVerifiedTotpFactor', () => {
  it('ignore un enrôlement abandonné (unverified)', () => {
    expect(pickVerifiedTotpFactor([{ id: 'a', status: 'unverified' }])).toBeNull()
  })
  it('renvoie le facteur vérifié', () => {
    expect(pickVerifiedTotpFactor([{ id: 'a', status: 'unverified' }, { id: 'b', status: 'verified' }])?.id).toBe('b')
  })
  it('ignore un facteur vérifié qui n\'est pas TOTP', () => {
    expect(pickVerifiedTotpFactor([{ id: 'p', status: 'verified', factor_type: 'phone' }])).toBeNull()
  })
  it('renvoie null sans aucun facteur', () => {
    expect(pickVerifiedTotpFactor([])).toBeNull()
  })
})

describe('isMfaChallengeRequired', () => {
  it('exige un code quand la session est aal1 et que aal2 est disponible', () => {
    expect(isMfaChallengeRequired('aal1', 'aal2')).toBe(true)
  })
  it('n\'exige rien sans 2FA activée (aal1 -> aal1)', () => {
    expect(isMfaChallengeRequired('aal1', 'aal1')).toBe(false)
  })
  it('n\'exige rien une fois le code validé (aal2 -> aal2)', () => {
    expect(isMfaChallengeRequired('aal2', 'aal2')).toBe(false)
  })
  it('gère les valeurs absentes', () => {
    expect(isMfaChallengeRequired(null, undefined)).toBe(false)
  })
})

describe('code TOTP', () => {
  it('retire les espaces', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456')
  })
  it('valide exactement 6 chiffres', () => {
    expect(isValidTotpCode('123456')).toBe(true)
    expect(isValidTotpCode('123 456')).toBe(true)
    expect(isValidTotpCode('12345')).toBe(false)
    expect(isValidTotpCode('1234567')).toBe(false)
    expect(isValidTotpCode('12a456')).toBe(false)
  })
})

import { getAalFromAccessToken, sessionNeedsMfa } from './mfa'

const jwt = (payload: object) => `x.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`

describe('getAalFromAccessToken', () => {
  it('lit le niveau aal du JWT', () => {
    expect(getAalFromAccessToken(jwt({ aal: 'aal1' }))).toBe('aal1')
    expect(getAalFromAccessToken(jwt({ aal: 'aal2' }))).toBe('aal2')
  })
  it('renvoie null pour un jeton illisible ou absent', () => {
    expect(getAalFromAccessToken('n-importe-quoi')).toBeNull()
    expect(getAalFromAccessToken(undefined)).toBeNull()
  })
})

describe('sessionNeedsMfa', () => {
  const verified = [{ id: 'f', status: 'verified', factor_type: 'totp' }]
  it('exige un code : facteur vérifié + session aal1', () => {
    expect(sessionNeedsMfa({ access_token: jwt({ aal: 'aal1' }), user: { factors: verified } })).toBe(true)
  })
  it('laisse passer une fois le code validé (aal2)', () => {
    expect(sessionNeedsMfa({ access_token: jwt({ aal: 'aal2' }), user: { factors: verified } })).toBe(false)
  })
  it('ne bloque jamais un compte sans 2FA', () => {
    expect(sessionNeedsMfa({ access_token: jwt({ aal: 'aal1' }), user: { factors: [] } })).toBe(false)
    expect(sessionNeedsMfa({ access_token: jwt({ aal: 'aal1' }), user: {} })).toBe(false)
  })
  it('ne bloque pas sur un enrôlement abandonné', () => {
    expect(sessionNeedsMfa({ access_token: jwt({ aal: 'aal1' }), user: { factors: [{ id: 'f', status: 'unverified' }] } })).toBe(false)
  })
  it('ne bloque pas sans session', () => {
    expect(sessionNeedsMfa(null)).toBe(false)
  })
})
