import { describe, it, expect } from 'vitest'
import { canSellSubscriptions } from '@/lib/nativeApp'

describe('canSellSubscriptions', () => {
  it('autorise les écrans de tarification et de paiement sur le site', () => {
    expect(canSellSubscriptions(false)).toBe(true)
  })
  it("les interdit dans l'application native (règles des stores)", () => {
    expect(canSellSubscriptions(true)).toBe(false)
  })
})
