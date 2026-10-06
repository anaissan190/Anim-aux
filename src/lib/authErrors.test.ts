import { describe, it, expect } from 'vitest'
import { classifyAuthError } from './authErrors'

describe('classifyAuthError', () => {
  it('reconnaît un email non confirmé par son code ou son message', () => {
    expect(classifyAuthError({ code: 'email_not_confirmed' })).toBe('email_not_confirmed')
    expect(classifyAuthError({ message: 'Email not confirmed' })).toBe('email_not_confirmed')
  })
  it('reconnaît un échec de captcha', () => {
    expect(classifyAuthError({ code: 'captcha_failed' })).toBe('captcha')
    expect(classifyAuthError({ message: 'captcha verification process failed' })).toBe('captcha')
  })
  it('reconnaît une limite de débit', () => {
    expect(classifyAuthError({ code: 'over_email_send_rate_limit' })).toBe('rate_limit')
    expect(classifyAuthError({ message: 'For security purposes, you can only request this after 60 seconds' })).toBe('rate_limit')
    expect(classifyAuthError({ message: 'Too many requests' })).toBe('rate_limit')
  })
  it("renvoie 'other' pour le reste, y compris une erreur absente", () => {
    expect(classifyAuthError({ message: 'Invalid login credentials' })).toBe('other')
    expect(classifyAuthError(null)).toBe('other')
  })
})
