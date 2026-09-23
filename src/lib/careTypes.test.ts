import { describe, it, expect } from 'vitest'
import { CARE_TYPES, careTypeLabel, careTypeIcon } from './careTypes'

describe('careTypeLabel', () => {
  it('renvoie le libellé pour chaque type de suivi connu', () => {
    expect(careTypeLabel('vaccine')).toBe('Vaccin')
    expect(careTypeLabel('deworming')).toBe('Vermifuge')
    expect(careTypeLabel('checkup')).toBe('Bilan annuel')
    expect(careTypeLabel('other')).toBe('Autre suivi')
  })

  it('retombe sur le libellé "Autre suivi" pour un type inconnu, null ou absent', () => {
    expect(careTypeLabel('quelque-chose-inconnu')).toBe('Autre suivi')
    expect(careTypeLabel(null)).toBe('Autre suivi')
    expect(careTypeLabel(undefined)).toBe('Autre suivi')
  })
})

describe('careTypeIcon', () => {
  it('renvoie l\'icône pour chaque type de suivi connu', () => {
    expect(careTypeIcon('vaccine')).toBe('💉')
    expect(careTypeIcon('deworming')).toBe('💊')
    expect(careTypeIcon('checkup')).toBe('🩺')
    expect(careTypeIcon('other')).toBe('📋')
  })

  it('retombe sur l\'icône "Autre suivi" pour un type inconnu, null ou absent', () => {
    expect(careTypeIcon('quelque-chose-inconnu')).toBe('📋')
    expect(careTypeIcon(null)).toBe('📋')
    expect(careTypeIcon(undefined)).toBe('📋')
  })
})

describe('CARE_TYPES', () => {
  it('couvre exactement les 4 types de suivi supportés par la contrainte SQL (migration 100)', () => {
    expect(CARE_TYPES.map(t => t.id)).toEqual(['vaccine', 'deworming', 'checkup', 'other'])
  })
})
