import { describe, it, expect } from 'vitest'
import {
  getTourSteps, shouldShowTour, pickVisibleSteps, computeTourGeometry,
  arrowPath, headPath, scribblePath,
} from './onboardingTour'

describe('getTourSteps', () => {
  it('propose des étapes différentes pour un patient et un praticien', () => {
    const patient = getTourSteps('patient').map(s => s.key)
    const doctor = getTourSteps('doctor').map(s => s.key)
    expect(patient).toContain('patient-tab:/animaux')
    expect(patient).not.toContain('doctor-tab:patients')
    expect(doctor).toContain('doctor-tab:patients')
    expect(doctor).not.toContain('patient-tab:/animaux')
  })

  it('explique aussi Tarifs, Avis et Statistiques au praticien', () => {
    const doctor = getTourSteps('doctor').map(s => s.key)
    expect(doctor).toEqual(expect.arrayContaining(['doctor-tab:tarifs', 'doctor-tab:avis', 'doctor-tab:stats']))
  })

  it('utilise des clés uniques dans chaque parcours', () => {
    for (const role of ['patient', 'doctor'] as const) {
      const keys = getTourSteps(role).map(s => s.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('donne un titre et un texte à chaque étape', () => {
    for (const role of ['patient', 'doctor'] as const) {
      for (const s of getTourSteps(role)) {
        expect(s.title.length).toBeGreaterThan(0)
        expect(s.body.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('shouldShowTour', () => {
  const base = { role: 'patient', isAdmin: false, onboardingCompletedAt: null, pathname: '/dashboard/patient' } as const

  it('affiche le tuto patient à la première arrivée sur son tableau de bord', () => {
    expect(shouldShowTour({ ...base })).toBe('patient')
  })

  it('affiche le tuto praticien sur le tableau de bord praticien', () => {
    expect(shouldShowTour({ ...base, role: 'doctor', pathname: '/dashboard/doctor' })).toBe('doctor')
  })

  it('ne l\'affiche pas si déjà terminé', () => {
    expect(shouldShowTour({ ...base, onboardingCompletedAt: '2026-09-25T10:00:00Z' })).toBeNull()
  })

  it('ne l\'affiche pas si la valeur est inconnue (profil en cache d\'avant la migration)', () => {
    expect(shouldShowTour({ ...base, onboardingCompletedAt: undefined })).toBeNull()
  })

  it('ne l\'affiche pas pour un admin, un secrétariat ou sans rôle', () => {
    expect(shouldShowTour({ ...base, isAdmin: true })).toBeNull()
    expect(shouldShowTour({ ...base, role: 'secretary' })).toBeNull()
    expect(shouldShowTour({ ...base, role: undefined })).toBeNull()
  })

  it('ne l\'affiche pas hors de la page d\'accueil de son rôle', () => {
    expect(shouldShowTour({ ...base, pathname: '/animaux' })).toBeNull()
    expect(shouldShowTour({ ...base, pathname: '/dashboard/doctor' })).toBeNull()
  })
})

describe('pickVisibleSteps', () => {
  it('ne garde que les étapes dont le bouton est visible', () => {
    const steps = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
    expect(pickVisibleSteps(steps, k => k !== 'b')).toEqual([{ key: 'a' }, { key: 'c' }])
  })

  it('renvoie une liste vide si rien n\'est visible', () => {
    expect(pickVisibleSteps([{ key: 'a' }], () => false)).toEqual([])
  })
})

describe('computeTourGeometry', () => {
  const phone = { width: 390, height: 780 }

  it('place la bulle au-dessus d\'un bouton de la moitié basse (barre d\'onglets)', () => {
    const g = computeTourGeometry({ left: 60, top: 700, width: 60, height: 50 }, phone, 150)
    expect(g.above).toBe(true)
    expect(g.bubbleTop + 150).toBeLessThan(700)
  })

  it('place la bulle sous un bouton de la moitié haute (cloche)', () => {
    const g = computeTourGeometry({ left: 300, top: 20, width: 40, height: 40 }, phone, 150)
    expect(g.above).toBe(false)
    expect(g.bubbleTop).toBeGreaterThan(60)
  })

  it('garde la bulle dans l\'écran horizontalement', () => {
    const right = computeTourGeometry({ left: 350, top: 20, width: 36, height: 36 }, phone, 150)
    expect(right.bubbleLeft).toBeGreaterThanOrEqual(16)
    expect(right.bubbleLeft + right.bubbleWidth).toBeLessThanOrEqual(phone.width - 16)
    const left = computeTourGeometry({ left: 0, top: 20, width: 36, height: 36 }, phone, 150)
    expect(left.bubbleLeft).toBeGreaterThanOrEqual(16)
  })

  it('reste dans l\'écran verticalement même avec une grande bulle', () => {
    const g = computeTourGeometry({ left: 100, top: 40, width: 40, height: 40 }, { width: 390, height: 300 }, 200)
    expect(g.bubbleTop).toBeGreaterThanOrEqual(8)
    expect(g.bubbleTop + 200).toBeLessThanOrEqual(300 - 8)
  })

  it('limite la largeur de la bulle sur un grand écran', () => {
    const g = computeTourGeometry({ left: 500, top: 20, width: 60, height: 36 }, { width: 1440, height: 900 }, 150)
    expect(g.bubbleWidth).toBe(300)
  })

  it('termine la flèche près du bouton, côté bulle', () => {
    const below = computeTourGeometry({ left: 300, top: 20, width: 40, height: 40 }, phone, 150)
    expect(below.arrow.end.y).toBeGreaterThan(40) // sous le bouton
    const above = computeTourGeometry({ left: 60, top: 700, width: 60, height: 50 }, phone, 150)
    expect(above.arrow.end.y).toBeLessThan(725) // au-dessus du bouton
  })
})

describe('chemins SVG', () => {
  const g = computeTourGeometry({ left: 100, top: 20, width: 40, height: 40 }, { width: 390, height: 780 }, 150)

  it('arrowPath produit une courbe cubique', () => {
    expect(arrowPath(g.arrow)).toMatch(/^M[\d.-]+ [\d.-]+ C/)
  })

  it('headPath produit deux segments', () => {
    expect(headPath(g.head).match(/L/g)).toHaveLength(2)
  })

  it('scribblePath produit un tracé de 45 points sans NaN', () => {
    const d = scribblePath(g.ring)
    expect(d.match(/[ML]/g)).toHaveLength(45)
    expect(d).not.toContain('NaN')
  })
})
