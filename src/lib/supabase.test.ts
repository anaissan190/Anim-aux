import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase, getMyUserDataWithRetry } from './supabase'

const FAKE_USER_DATA = {
  role: 'patient' as const, is_admin: false, is_suspended: false, suspended_reason: null, profile: null,
}

describe('getMyUserDataWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renvoie les données au premier essai réussi, sans retenter', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: FAKE_USER_DATA, error: null } as any)

    const result = await getMyUserDataWithRetry()

    expect(result).toEqual(FAKE_USER_DATA)
    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith('get_my_user_data')
  })

  it('retente après une erreur logique (error non-null) puis réussit', async () => {
    vi.useFakeTimers()
    vi.spyOn(supabase, 'rpc')
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } } as any)
      .mockResolvedValueOnce({ data: FAKE_USER_DATA, error: null } as any)

    const promise = getMyUserDataWithRetry()
    await vi.advanceTimersByTimeAsync(800) // laisse s'écouler le délai entre tentatives
    const result = await promise

    expect(result).toEqual(FAKE_USER_DATA)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it('retente si le RPC lève une exception (panne réseau) plutôt qu\'une simple erreur logique', async () => {
    vi.useFakeTimers()
    vi.spyOn(supabase, 'rpc')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: FAKE_USER_DATA, error: null } as any)

    const promise = getMyUserDataWithRetry()
    await vi.advanceTimersByTimeAsync(800)
    const result = await promise

    expect(result).toEqual(FAKE_USER_DATA)
  })

  it('renvoie null après 3 échecs consécutifs, sans lever d\'exception', async () => {
    vi.useFakeTimers()
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: { message: 'fail' } } as any)

    const promise = getMyUserDataWithRetry()
    await vi.advanceTimersByTimeAsync(800)
    await vi.advanceTimersByTimeAsync(800)
    const result = await promise

    expect(result).toBeNull()
    expect(rpcSpy).toHaveBeenCalledTimes(3)
  })

  it('renvoie null si aucune tentative ne répond avant le timeout', async () => {
    vi.useFakeTimers()
    // Le RPC ne se résout jamais : seul le timeout interne peut débloquer chaque tentative.
    vi.spyOn(supabase, 'rpc').mockImplementation(() => new Promise(() => {}) as any)

    const promise = getMyUserDataWithRetry(1000)
    await vi.advanceTimersByTimeAsync(1000) // timeout tentative 1
    await vi.advanceTimersByTimeAsync(800)  // délai avant tentative 2
    await vi.advanceTimersByTimeAsync(1000) // timeout tentative 2
    await vi.advanceTimersByTimeAsync(800)  // délai avant tentative 3
    await vi.advanceTimersByTimeAsync(1000) // timeout tentative 3
    const result = await promise

    expect(result).toBeNull()
  })

  it('ne retente pas si data est null même sans erreur explicite', async () => {
    vi.useFakeTimers()
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as any)

    const promise = getMyUserDataWithRetry()
    await vi.advanceTimersByTimeAsync(800)
    await vi.advanceTimersByTimeAsync(800)
    const result = await promise

    expect(result).toBeNull()
    expect(rpcSpy).toHaveBeenCalledTimes(3)
  })
})
