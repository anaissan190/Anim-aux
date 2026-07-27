import { describe, it, expect } from 'vitest'
import { PRACTITIONER_TYPES, getPractitionerType } from './practitionerTypes'

describe('getPractitionerType', () => {
  it('retrouve un type de praticien par son id', () => {
    const vet = getPractitionerType('veterinaire')
    expect(vet).toBeDefined()
    expect(vet?.label).toBe('Vétérinaire')
  })

  it('renvoie undefined pour un id inconnu', () => {
    expect(getPractitionerType('ne-existe-pas')).toBeUndefined()
  })
})

describe('PRACTITIONER_TYPES — intégrité des données', () => {
  it('n\'a aucun id en double (utilisé comme clé unique partout dans l\'appli)', () => {
    const ids = PRACTITIONER_TYPES.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('inclut toujours "autre" comme dernier choix, en filet de sécurité', () => {
    expect(PRACTITIONER_TYPES[PRACTITIONER_TYPES.length - 1].id).toBe('autre')
  })

  it('donne au moins un service à chaque métier', () => {
    for (const type of PRACTITIONER_TYPES) {
      expect(type.services.length).toBeGreaterThan(0)
    }
  })
})
