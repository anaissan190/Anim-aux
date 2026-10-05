import { describe, it, expect } from 'vitest'
import { isCareLinkAppointment } from './careLink'

const NOW = new Date('2026-10-05T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()

describe('isCareLinkAppointment', () => {
  it('compte un rendez-vous confirmé à venir (premier RDV maintenu)', () => {
    expect(isCareLinkAppointment({ status: 'confirmed', start_at: daysAhead(3) }, NOW)).toBe(true)
  })
  it('compte un rendez-vous terminé récent', () => {
    expect(isCareLinkAppointment({ status: 'completed', start_at: daysAgo(30) }, NOW)).toBe(true)
  })
  it('compte un rendez-vous passé resté "confirmé" (non clôturé par le praticien)', () => {
    expect(isCareLinkAppointment({ status: 'confirmed', start_at: daysAgo(10) }, NOW)).toBe(true)
  })
  it('ne compte pas un rendez-vous annulé', () => {
    expect(isCareLinkAppointment({ status: 'cancelled', start_at: daysAhead(3) }, NOW)).toBe(false)
  })
  it('ne compte pas un patient absent', () => {
    expect(isCareLinkAppointment({ status: 'no_show', start_at: daysAgo(3) }, NOW)).toBe(false)
  })
  it('ne compte plus un rendez-vous de plus d\'un an', () => {
    expect(isCareLinkAppointment({ status: 'completed', start_at: daysAgo(400) }, NOW)).toBe(false)
  })
  it('compte encore un rendez-vous juste en dessous d\'un an', () => {
    expect(isCareLinkAppointment({ status: 'completed', start_at: daysAgo(360) }, NOW)).toBe(true)
  })
})
