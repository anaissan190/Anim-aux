import { describe, it, expect } from 'vitest'
import { DOCTOR_TABS, ALL_DOCTOR_TAB_IDS } from './doctorDashboardTabs'

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
