import { describe, it, expect } from 'vitest'
import { generateAppointmentIcs } from './ics'

describe('generateAppointmentIcs', () => {
  const base = {
    id: 'appt-1',
    startAt: '2026-08-15T14:30:00.000Z',
    endAt: '2026-08-15T15:00:00.000Z',
    doctorName: 'Dr Martin',
  }

  it('génère un VCALENDAR valide avec les dates au format UTC ICS', () => {
    const ics = generateAppointmentIcs(base)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('DTSTART:20260815T143000Z')
    expect(ics).toContain('DTEND:20260815T150000Z')
    expect(ics).toContain('UID:appointment-appt-1@monanimeaux.fr')
  })

  it('inclut la spécialité dans le résumé quand fournie', () => {
    const ics = generateAppointmentIcs({ ...base, specialty: 'Vétérinaire' })
    expect(ics).toContain('SUMMARY:RDV avec Dr Martin (Vétérinaire)')
  })

  it("n'ajoute pas de parenthèses vides sans spécialité", () => {
    const ics = generateAppointmentIcs(base)
    expect(ics).toContain('SUMMARY:RDV avec Dr Martin')
    expect(ics).not.toContain('()')
  })

  it('combine adresse et ville dans LOCATION, absent si aucune des deux', () => {
    const withLocation = generateAppointmentIcs({ ...base, address: '12 rue des Lilas', city: 'Paris' })
    expect(withLocation).toContain('LOCATION:12 rue des Lilas\\, Paris')

    const withoutLocation = generateAppointmentIcs(base)
    expect(withoutLocation).not.toContain('LOCATION:')
  })

  it('échappe les virgules, points-virgules et antislashs dans les champs texte', () => {
    const ics = generateAppointmentIcs({ ...base, reason: 'Contrôle; vaccin, rappel \\ suivi' })
    expect(ics).toContain('Contrôle\\; vaccin\\, rappel \\\\ suivi')
  })

  it('inclut le motif dans la description quand fourni', () => {
    const ics = generateAppointmentIcs({ ...base, reason: 'Vaccination annuelle' })
    expect(ics).toContain('DESCRIPTION:Motif : Vaccination annuelle\\nPris via Animéaux')
  })

  it('la description ne mentionne que la provenance sans motif', () => {
    const ics = generateAppointmentIcs(base)
    expect(ics).toContain('DESCRIPTION:Pris via Animéaux')
  })

  it('utilise des fins de ligne CRLF (RFC 5545)', () => {
    const ics = generateAppointmentIcs(base)
    expect(ics).toContain('\r\n')
    expect(ics.split('\r\n').every(line => !line.includes('\n'))).toBe(true)
  })
})
