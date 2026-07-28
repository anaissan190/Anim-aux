import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { supabase } from './supabase'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, profile: null, loading: false })
    vi.restoreAllMocks()
  })

  it('setUser / setProfile / setLoading mettent à jour l\'état', () => {
    const fakeUser = { id: 'u1', email: 'a@a.fr', role: 'patient' as const, is_admin: false, created_at: '' }
    useAuthStore.getState().setUser(fakeUser)
    useAuthStore.getState().setProfile({ id: 'p1', user_id: 'u1', first_name: 'Anaïs', last_name: 'S' } as any)
    useAuthStore.getState().setLoading(true)

    expect(useAuthStore.getState().user).toEqual(fakeUser)
    expect(useAuthStore.getState().profile?.first_name).toBe('Anaïs')
    expect(useAuthStore.getState().loading).toBe(true)
  })

  it('signOut appelle supabase.auth.signOut() puis vide user/profile/loading', async () => {
    const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null } as any)
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@a.fr', role: 'patient', is_admin: false, created_at: '' },
      profile: { id: 'p1', user_id: 'u1', first_name: 'Anaïs', last_name: 'S' } as any,
      loading: true,
    })

    await useAuthStore.getState().signOut()

    expect(signOutSpy).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().profile).toBeNull()
    expect(useAuthStore.getState().loading).toBe(false)
  })
})
