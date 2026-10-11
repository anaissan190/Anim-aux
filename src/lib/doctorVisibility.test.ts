import { describe, it, expect } from 'vitest'
import { isPubliclyListed } from './doctorVisibility'

describe('isPubliclyListed', () => {
  it('affiche un praticien vérifié qui ne s\'est pas masqué', () => {
    expect(isPubliclyListed({ verification_status: 'verified', is_listed: true })).toBe(true)
  })

  it('masque un praticien qui a choisi de se retirer de la recherche', () => {
    expect(isPubliclyListed({ verification_status: 'verified', is_listed: false })).toBe(false)
  })

  it('considère visible un profil sans information is_listed (cache d\'avant la migration)', () => {
    expect(isPubliclyListed({ verification_status: 'verified' })).toBe(true)
    expect(isPubliclyListed({ verification_status: 'verified', is_listed: null })).toBe(true)
  })

  it('masque un praticien non vérifié, même s\'il est « visible »', () => {
    expect(isPubliclyListed({ verification_status: 'pending', is_listed: true })).toBe(false)
    expect(isPubliclyListed({ verification_status: 'rejected', is_listed: true })).toBe(false)
    expect(isPubliclyListed({ is_listed: true })).toBe(false)
  })

  it('masque l\'absence de praticien', () => {
    expect(isPubliclyListed(null)).toBe(false)
    expect(isPubliclyListed(undefined)).toBe(false)
  })
})
