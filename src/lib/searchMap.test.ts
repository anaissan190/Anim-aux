import { describe, it, expect } from 'vitest'
import { buildMapPoints } from './searchMap'

describe('buildMapPoints', () => {
  const doctor = (over: object = {}) => ({ id: 'd1', lat: 48.85, lng: 2.35, city: 'Paris', specialties: ['Ostéopathe animalier'], profiles: { first_name: 'Claire', last_name: 'Martin' }, ...over })

  it('place un praticien avec son nom, ses métiers et un lien vers sa fiche', () => {
    const { points } = buildMapPoints([doctor()], [])
    expect(points).toEqual([{ key: 'doctor-d1', kind: 'doctor', lat: 48.85, lng: 2.35, title: 'Claire Martin', subtitle: 'Ostéopathe animalier — Paris', href: '/doctor/d1' }])
  })

  it('préfixe « Dr » pour un vétérinaire', () => {
    const { points } = buildMapPoints([doctor({ specialties: ['Vétérinaire'] })], [])
    expect(points[0].title).toBe('Dr Claire Martin')
  })

  it('place un cabinet avec un lien vers sa fiche', () => {
    const { points } = buildMapPoints([], [{ id: 'c1', name: 'Clinique du Parc', lat: 45.7, lng: 4.8, city: 'Lyon' }])
    expect(points[0]).toMatchObject({ kind: 'clinic', title: 'Clinique du Parc', subtitle: 'Lyon', href: '/cabinet/c1' })
  })

  it('compte à part les résultats sans coordonnées au lieu de les perdre', () => {
    const { points, withoutCoordinates } = buildMapPoints(
      [doctor({ lat: null }), doctor({ id: 'd2', lng: undefined }), doctor({ id: 'd3' })],
      [{ id: 'c1', name: 'Sans coords', lat: null, lng: null }],
    )
    expect(points).toHaveLength(1)
    expect(withoutCoordinates).toBe(3)
  })

  it('ignore des coordonnées non numériques', () => {
    const { points, withoutCoordinates } = buildMapPoints([doctor({ lat: NaN })], [])
    expect(points).toEqual([])
    expect(withoutCoordinates).toBe(1)
  })

  it('renvoie des listes vides sans résultat', () => {
    expect(buildMapPoints([], [])).toEqual({ points: [], withoutCoordinates: 0 })
  })
})
