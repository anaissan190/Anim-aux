import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { geocodeAddress, haversineKm } from './geo'

describe('haversineKm', () => {
  it('renvoie 0 pour deux points identiques', () => {
    expect(haversineKm(48.8566, 2.3522, 48.8566, 2.3522)).toBeCloseTo(0, 5)
  })

  it('calcule une distance cohérente Paris → Lyon (~390km à vol d\'oiseau)', () => {
    const km = haversineKm(48.8566, 2.3522, 45.7640, 4.8357)
    expect(km).toBeGreaterThan(380)
    expect(km).toBeLessThan(400)
  })
})

describe('geocodeAddress', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renvoie null si adresse et ville sont vides', async () => {
    const result = await geocodeAddress(undefined, undefined)
    expect(result).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('renvoie les coordonnées lat/lng du premier résultat', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ geometry: { coordinates: [2.3522, 48.8566] } }],
      }),
    } as Response)

    const result = await geocodeAddress('10 rue de Rivoli', 'Paris')
    expect(result).toEqual({ lat: 48.8566, lng: 2.3522 })
  })

  it('renvoie null si aucun résultat trouvé', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    } as Response)

    const result = await geocodeAddress('adresse inexistante', 'Nulle-Part')
    expect(result).toBeNull()
  })

  it('renvoie null si la requête réseau échoue', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network error'))
    const result = await geocodeAddress('10 rue de Rivoli', 'Paris')
    expect(result).toBeNull()
  })

  it('renvoie null si la réponse HTTP n\'est pas ok', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false } as Response)
    const result = await geocodeAddress('10 rue de Rivoli', 'Paris')
    expect(result).toBeNull()
  })
})
