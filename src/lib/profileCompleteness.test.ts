import { describe, it, expect } from 'vitest'
import { profileCompleteness, plainText, MIN_BIO_CHARS } from './profileCompleteness'

const full = {
  avatarUrl: 'https://x/photo.jpg', specialties: ['Vétérinaire'],
  bioHtml: '<p>Vétérinaire canin et félin depuis dix ans.</p>', phone: '06 12 34 56 78',
  acceptedSpecies: ['Chien'], hasAddress: true, hasVerificationDocument: true,
}

describe('profileCompleteness', () => {
  it('donne 100 % et aucune suggestion pour un profil complet', () => {
    expect(profileCompleteness(full)).toEqual({ percent: 100, done: 7, total: 7, hint: null })
  })

  it("compte les éléments manquants et suggère le premier, dans l'ordre de la page", () => {
    const r = profileCompleteness({ ...full, acceptedSpecies: [], phone: '' })
    expect(r).toMatchObject({ done: 5, total: 7, percent: 71, hint: 'Ajoutez un numéro de téléphone' })
  })

  it('part de presque rien pour un profil vide, sans planter sur des valeurs absentes', () => {
    const r = profileCompleteness({ hasAddress: false, hasVerificationDocument: false })
    expect(r).toMatchObject({ done: 0, percent: 0, hint: 'Ajoutez une photo' })
    expect(profileCompleteness({ avatarUrl: null, specialties: null, bioHtml: null, phone: null, acceptedSpecies: null, hasAddress: false, hasVerificationDocument: false }).percent).toBe(0)
  })

  it("une présentation trop courte ou faite de balises vides ne compte pas", () => {
    expect(profileCompleteness({ ...full, bioHtml: '<p>Bonjour</p>' }).hint).toBe('Rédigez une présentation')
    expect(profileCompleteness({ ...full, bioHtml: '<p><br></p>' }).hint).toBe('Rédigez une présentation')
    expect(profileCompleteness({ ...full, bioHtml: `<p>${'a'.repeat(MIN_BIO_CHARS)}</p>` }).hint).toBeNull()
  })

  it("un numéro fait d'espaces ne compte pas", () => {
    expect(profileCompleteness({ ...full, phone: '   ' }).hint).toBe('Ajoutez un numéro de téléphone')
  })
})

describe('plainText', () => {
  it('retire les balises et les espaces insécables', () => {
    expect(plainText('<p>Un&nbsp;<b>texte</b>   riche</p>')).toBe('Un texte riche')
    expect(plainText(null)).toBe('')
  })
})
