import { describe, it, expect } from 'vitest'
import { DOCTOR_TABS, ALL_DOCTOR_TAB_IDS, FREE_PLAN_LOCKED_TABS, LOCKED_TAB_PITCH, isTabLocked } from './doctorDashboardTabs'

describe('doctorDashboardTabs — intégrité des données', () => {
  it('chaque onglet affiché dans la barre est un DoctorTab valide', () => {
    for (const tab of DOCTOR_TABS) {
      expect(ALL_DOCTOR_TAB_IDS).toContain(tab.id)
    }
  })

  it('n\'a pas d\'id d\'onglet en double dans la barre affichée', () => {
    const ids = DOCTOR_TABS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('n\'a pas d\'id en double dans la liste complète des onglets', () => {
    expect(new Set(ALL_DOCTOR_TAB_IDS).size).toBe(ALL_DOCTOR_TAB_IDS.length)
  })

  it('inclut toujours "profil" et "messages" même sans lien direct dans la barre', () => {
    // Accessibles via les icônes de la navbar plutôt qu'un onglet dédié
    // (voir commentaire dans doctorDashboardTabs.ts) — mais doivent rester
    // des DoctorTab valides pour que ?tab=profil / ?tab=messages fonctionne.
    expect(ALL_DOCTOR_TAB_IDS).toContain('profil')
    expect(ALL_DOCTOR_TAB_IDS).toContain('messages')
  })
})

describe('doctorDashboardTabs — offre gratuite', () => {
  it('verrouille réservation, agenda, patients, tarifs et statistiques', () => {
    for (const tab of ['patients', 'tarifs', 'disponibilites', 'stats']) {
      expect(isTabLocked(tab, false)).toBe(true)
    }
  })

  it('laisse ouverts Mon espace, Avis, Profil, Messages et Cabinet', () => {
    for (const tab of ['home', 'avis', 'profil', 'messages', 'cabinet']) {
      expect(isTabLocked(tab, false)).toBe(false)
    }
  })

  it('ne verrouille rien pour un abonné, ni tant que l\'offre n\'est pas connue', () => {
    for (const tab of ALL_DOCTOR_TAB_IDS) {
      expect(isTabLocked(tab, true)).toBe(false)
      expect(isTabLocked(tab, undefined)).toBe(false)
    }
  })

  it('ne verrouille que des onglets valides, chacun avec son texte d\'explication', () => {
    for (const tab of FREE_PLAN_LOCKED_TABS) {
      expect(ALL_DOCTOR_TAB_IDS).toContain(tab)
      expect(LOCKED_TAB_PITCH[tab]?.title).toBeTruthy()
      expect(LOCKED_TAB_PITCH[tab]?.body).toBeTruthy()
    }
  })
})
