import { describe, it, expect, vi } from 'vitest'
import { shouldReloadAfterChunkError, installChunkErrorReload, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS } from './chunkReload'

describe('shouldReloadAfterChunkError', () => {
  it('recharge si on ne l\'a jamais fait', () => {
    expect(shouldReloadAfterChunkError(null, 1_000)).toBe(true)
  })
  it('ne recharge pas une seconde fois dans la minute (évite une boucle)', () => {
    expect(shouldReloadAfterChunkError(1_000, 1_000 + CHUNK_RELOAD_COOLDOWN_MS - 1)).toBe(false)
  })
  it('recharge à nouveau une fois le délai passé', () => {
    expect(shouldReloadAfterChunkError(1_000, 1_000 + CHUNK_RELOAD_COOLDOWN_MS + 1)).toBe(true)
  })
})

function setup(initial: string | null = null) {
  const store = new Map<string, string>(initial ? [[CHUNK_RELOAD_KEY, initial]] : [])
  const target = new EventTarget()
  const reload = vi.fn()
  installChunkErrorReload({
    target: target as any,
    storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v) } },
    now: () => 5_000_000,
    reload,
  })
  const fire = () => {
    const event = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(event)
    return event
  }
  return { store, reload, fire }
}

describe('installChunkErrorReload', () => {
  it('recharge la page et mémorise l\'heure à la première erreur de chargement', () => {
    const { store, reload, fire } = setup()
    const event = fire()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get(CHUNK_RELOAD_KEY)).toBe('5000000')
    expect(event.defaultPrevented).toBe(true)
  })
  it('ne recharge pas en boucle si un rechargement vient d\'avoir lieu', () => {
    const { reload, fire } = setup('4990000')
    fire()
    expect(reload).not.toHaveBeenCalled()
  })
  it('fonctionne même sans stockage disponible', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    installChunkErrorReload({ target: target as any, storage: null, now: () => 1, reload })
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
