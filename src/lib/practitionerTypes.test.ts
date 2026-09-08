import { describe, it, expect } from 'vitest'
import { PRACTITIONER_TYPES, getPractitionerType, formatDoctorName } from './practitionerTypes'

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

describe('formatDoctorName', () => {
  it('ajoute "Dr" pour un vétérinaire', () => {
    expect(formatDoctorName('Vétérinaire', 'Camille', 'Dupont')).toBe('Dr Camille Dupont')
  })

  it('n\'ajoute pas "Dr" pour un métier non-vétérinaire', () => {
    expect(formatDoctorName('Comportementaliste animalier', 'Camille', 'Dupont')).toBe('Camille Dupont')
    expect(formatDoctorName('Toiletteur', 'Camille', 'Dupont')).toBe('Camille Dupont')
    expect(formatDoctorName('Éducateur canin', 'Camille', 'Dupont')).toBe('Camille Dupont')
  })

  it('n\'ajoute pas "Dr" quand la spécialité est absente ou vide', () => {
    expect(formatDoctorName(null, 'Camille', 'Dupont')).toBe('Camille Dupont')
    expect(formatDoctorName(undefined, 'Camille', 'Dupont')).toBe('Camille Dupont')
    expect(formatDoctorName('', 'Camille', 'Dupont')).toBe('Camille Dupont')
  })

  it('est sensible à la casse et au libellé exact (pas de correspondance partielle)', () => {
    expect(formatDoctorName('vétérinaire', 'Camille', 'Dupont')).toBe('Camille Dupont')
    expect(formatDoctorName('Vétérinaire généraliste', 'Camille', 'Dupont')).toBe('Camille Dupont')
  })

  it('gère un prénom/nom manquant sans planter', () => {
    expect(formatDoctorName('Vétérinaire', null, undefined)).toBe('Dr  ')
  })
})
