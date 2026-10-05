import { describe, it, expect } from 'vitest'
import { csvCell, buildAccountingRows, buildAccountingCsv } from './accountingExport'

const appts = [
  { start_at: '2026-09-10T08:00:00Z', status: 'completed', reason: 'Vaccin — chat enrhumé', profiles: { first_name: 'Claire', last_name: 'Martin' }, animals: [{ name: 'Mimi' }, { name: 'Tom' }] },
  { start_at: '2026-09-02T13:30:00Z', status: 'completed', reason: 'Bilan annuel', profiles: { first_name: 'Hugo', last_name: 'Bernard' }, animals: [] },
  { start_at: '2026-09-05T08:00:00Z', status: 'cancelled', profiles: null },
  { start_at: '2026-08-31T08:00:00Z', status: 'completed', profiles: null },
]

describe('csvCell', () => {
  it('échappe guillemets et séparateurs', () => {
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""')
  })
  it('neutralise une formule Excel', () => {
    expect(csvCell('=SOMME(A1)')).toBe("'=SOMME(A1)")
    expect(csvCell('+33')).toBe("'+33")
  })
  it('remplace les retours à la ligne', () => {
    expect(csvCell('a\nb')).toBe('a b')
  })
})

describe('buildAccountingRows', () => {
  it('ne garde que les consultations terminées du mois, triées par date, heure de Paris', () => {
    const rows = buildAccountingRows(appts, '2026-09', 45)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['02/09/2026', '15:30', 'Hugo Bernard', '', 'Bilan annuel', '45,00'])
    expect(rows[1]).toEqual(['10/09/2026', '10:00', 'Claire Martin', 'Mimi, Tom', 'Vaccin', '45,00'])
  })
})

describe('buildAccountingCsv', () => {
  it('commence par un BOM, utilise ";" et termine par le total', () => {
    const csv = buildAccountingCsv(appts, '2026-09', 45)
    expect(csv.startsWith('﻿Date;Heure;Patient')).toBe(true)
    expect(csv.split('\r\n').pop()).toBe('TOTAL;;;;2 consultation(s);90,00')
  })
  it('donne un total à 0 sans consultation', () => {
    expect(buildAccountingCsv([], '2026-09', 45).split('\r\n').pop()).toBe('TOTAL;;;;0 consultation(s);0,00')
  })
})
