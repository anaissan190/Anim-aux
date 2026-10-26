import { describe, it, expect } from 'vitest'
import {
  parseLaunchSettings, DEFAULT_LAUNCH_SETTINGS, isIntendedPlan, formatLaunchDate, launchLabel,
  daysUntil, thresholdProgress, parseThreshold, prelaunchToCsv,
} from './prelaunch'

describe('parseLaunchSettings', () => {
  it('lit la phase et la date', () => {
    expect(parseLaunchSettings([
      { key: 'launch_phase', value: 'prelaunch' },
      { key: 'public_launch_date', value: '2027-01-15' },
    ])).toEqual({ phase: 'prelaunch', publicLaunchDate: '2027-01-15' })
  })
  it('retombe sur le comportement actuel sans réglage ou avec une valeur inconnue', () => {
    expect(parseLaunchSettings(null)).toEqual(DEFAULT_LAUNCH_SETTINGS)
    expect(parseLaunchSettings([])).toEqual(DEFAULT_LAUNCH_SETTINGS)
    expect(parseLaunchSettings([{ key: 'launch_phase', value: 'n-importe-quoi' }])).toEqual(DEFAULT_LAUNCH_SETTINGS)
  })
  it('ignore une date mal formée', () => {
    expect(parseLaunchSettings([{ key: 'public_launch_date', value: '15/01/2027' }]).publicLaunchDate).toBeNull()
    expect(parseLaunchSettings([{ key: 'public_launch_date', value: '' }]).publicLaunchDate).toBeNull()
    expect(parseLaunchSettings([{ key: 'public_launch_date', value: '2027-02-30' }]).publicLaunchDate).toBeNull()
  })
})

describe('isIntendedPlan', () => {
  it('accepte les trois formules seulement', () => {
    expect(['free', 'pro', 'cabinet'].every(isIntendedPlan)).toBe(true)
    expect(isIntendedPlan('custom')).toBe(false)
    expect(isIntendedPlan(null)).toBe(false)
  })
})

describe('formatLaunchDate / launchLabel', () => {
  const now = new Date('2026-12-01T10:00:00Z')
  it("n'affiche l'année que si ce n'est pas l'année courante", () => {
    expect(formatLaunchDate('2026-12-24', now)).toBe('24 décembre')
    expect(formatLaunchDate('2027-01-15', now)).toBe('15 janvier 2027')
  })
  it('reste neutre sans date', () => {
    expect(formatLaunchDate(null, now)).toBeNull()
    expect(launchLabel(null, now)).toBe('Ouverture bientôt')
    expect(launchLabel('2027-01-15', now)).toBe('Ouverture le 15 janvier 2027')
  })
  it('rejette une date invalide', () => {
    expect(formatLaunchDate('2027-13-45', now)).toBeNull()
    expect(formatLaunchDate('demain', now)).toBeNull()
  })
})

describe('daysUntil', () => {
  const now = new Date('2026-11-24T08:00:00Z')
  it('compte les jours restants', () => {
    expect(daysUntil('2026-12-01', now)).toBe(7)
    expect(daysUntil('2026-11-24', now)).toBe(0)
  })
  it('renvoie null sans date ou si elle est passée', () => {
    expect(daysUntil(null, now)).toBeNull()
    expect(daysUntil('2026-11-23', now)).toBeNull()
  })
})

describe('thresholdProgress / parseThreshold', () => {
  it('calcule un pourcentage plafonné', () => {
    expect(thresholdProgress(38, 100)).toBe(38)
    expect(thresholdProgress(150, 100)).toBe(100)
    expect(thresholdProgress(0, 100)).toBe(0)
  })
  it('ne fait pas de jauge sans seuil valide', () => {
    expect(thresholdProgress(10, null)).toBeNull()
    expect(thresholdProgress(10, 0)).toBeNull()
  })
  it('lit le seuil saisi', () => {
    expect(parseThreshold('100')).toBe(100)
    expect(parseThreshold(' 40 ')).toBe(40)
    expect(parseThreshold('')).toBeNull()
    expect(parseThreshold('0')).toBeNull()
    expect(parseThreshold('abc')).toBeNull()
  })
})

describe('prelaunchToCsv', () => {
  const row = {
    first_name: 'Marie', last_name: 'Dupont', email: 'marie@exemple.fr', specialties: ['Vétérinaire', 'Ostéopathe animalier'],
    city: 'Lyon', verification_status: 'verified', intended_plan: 'pro', created_at: '2026-12-03T09:00:00Z',
  }
  it('produit un en-tête et une ligne lisibles', () => {
    const csv = prelaunchToCsv([row]).replace('﻿', '').split('\r\n')
    expect(csv[0]).toBe('Prénom;Nom;Email;Métiers;Ville;Dossier;Formule souhaitée;Inscrit le')
    expect(csv[1]).toBe('Marie;Dupont;marie@exemple.fr;Vétérinaire, Ostéopathe animalier;Lyon;Validé;Abonnement;2026-12-03')
  })
  it('indique quand la formule reste à choisir', () => {
    expect(prelaunchToCsv([{ ...row, intended_plan: null }])).toContain('Pas encore choisie')
  })
  it("neutralise les cellules qu'un tableur lirait comme une formule", () => {
    const csv = prelaunchToCsv([{ ...row, last_name: '=HYPERLINK("http://x")' }])
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
  })
  it('met entre guillemets les cellules contenant le séparateur', () => {
    expect(prelaunchToCsv([{ ...row, city: 'Aix; en-Provence' }])).toContain('"Aix; en-Provence"')
  })
  it('gère une liste vide', () => {
    expect(prelaunchToCsv([]).replace('﻿', '').split('\r\n')).toHaveLength(1)
  })
})
