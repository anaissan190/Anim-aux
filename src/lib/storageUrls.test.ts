import { describe, it, expect } from 'vitest'
import { documentStoragePath } from './storageUrls'

const BASE = 'https://abc.supabase.co/storage/v1/object'

describe('documentStoragePath', () => {
  it("extrait le chemin d'une URL publique", () => {
    expect(documentStoragePath(`${BASE}/public/documents/animals/a1-170-xyz.pdf`)).toBe('animals/a1-170-xyz.pdf')
  })
  it("extrait le chemin d'une URL signée en ignorant le jeton", () => {
    expect(documentStoragePath(`${BASE}/sign/documents/appointments/170-abc.png?token=eyJabc`)).toBe('appointments/170-abc.png')
  })
  it('décode les caractères encodés', () => {
    expect(documentStoragePath(`${BASE}/public/documents/animals/mon%20fichier.pdf`)).toBe('animals/mon fichier.pdf')
  })
  it('renvoie un chemin brut tel quel', () => {
    expect(documentStoragePath('animals/a1-170-xyz.pdf')).toBe('animals/a1-170-xyz.pdf')
  })
  it("renvoie null pour une URL d'un autre bucket ou d'un autre site", () => {
    expect(documentStoragePath(`${BASE}/public/avatars/animals/x.jpg`)).toBeNull()
    expect(documentStoragePath('https://exemple.fr/fichier.pdf')).toBeNull()
  })
  it('renvoie null sans valeur', () => {
    expect(documentStoragePath(undefined)).toBeNull()
    expect(documentStoragePath('')).toBeNull()
  })
})
