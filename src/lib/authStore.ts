import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from './supabase'
import type { User as AppUser, Profile } from '@/types'

interface AuthState {
  user: AppUser | null
  profile: Profile | null
  loading: boolean
  setUser: (user: AppUser | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      loading: false,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null, loading: false })
      },
    }),
    {
      name: 'pawcare-auth',
      partialize: (state) => ({ user: state.user, profile: state.profile }),
    }
  )
)
