import { describe, it, expect } from 'vitest'
import { SPECIES_GROUPS, ALL_SPECIES, SPECIES_MAX_WEIGHT, SPECIES_EMOJI, BREED_PLACEHOLDER } from './animalSpecies'

describe('ALL_SPECIES / SPECIES_MAX_WEIGHT — intégrité des données', () => {
  it('ALL_SPECIES contient bien toutes les espèces de tous les groupes', () => {
    const expectedCount = SPECIES_GROUPS.reduce((sum, g) => sum + g.species.length, 0)
    expect(ALL_SPECIES.length).toBe(expectedCount)
  })

  it('n\'a aucun nom d\'espèce en double entre les groupes', () => {
    // SPECIES_MAX_WEIGHT/SPECIES_EMOJI utilisent le nom comme clé : un
    // doublon entre deux groupes écraserait silencieusement une entrée.
    const names = ALL_SPECIES.map(s => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('a un poids maximal renseigné pour chaque espèce', () => {
    for (const species of ALL_SPECIES) {
      expect(SPECIES_MAX_WEIGHT[species.name]).toBe(species.maxWeight)
    }
  })

  it('n\'a que des poids maximaux strictement positifs', () => {
    for (const species of ALL_SPECIES) {
      expect(species.maxWeight).toBeGreaterThan(0)
    }
  })

  it('n\'a pas de clé orpheline dans SPECIES_EMOJI (typo ou espèce renommée)', () => {
    const validNames = new Set(ALL_SPECIES.map(s => s.name))
    for (const name of Object.keys(SPECIES_EMOJI)) {
      expect(validNames.has(name)).toBe(true)
    }
  })

  it('n\'a pas de clé orpheline dans BREED_PLACEHOLDER (typo ou espèce renommée)', () => {
    const validNames = new Set(ALL_SPECIES.map(s => s.name))
    for (const name of Object.keys(BREED_PLACEHOLDER)) {
      expect(validNames.has(name)).toBe(true)
    }
  })
})
