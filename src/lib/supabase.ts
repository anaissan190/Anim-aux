// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { UserRole, Profile } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes dans .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

// Récupère { role, profile } via le RPC get_my_user_data(), avec une tentative
// de retry en cas de timeout/erreur. Supabase connaît parfois des instabilités
// ponctuelles (voir status.supabase.com) qui font échouer le premier essai ;
// sans retry, ça faisait basculer silencieusement le rôle sur 'patient' et
// envoyait les praticiens sur le mauvais dashboard.
export async function getMyUserDataWithRetry(timeoutMs = 8000): Promise<{ role: UserRole; is_admin: boolean; profile: Profile | null } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      const rpcCall = supabase.rpc('get_my_user_data')
      const { data, error } = (await Promise.race([rpcCall, timeout])) as any
      if (!error && data) return data
    } catch {
      // on retente avant d'abandonner
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 800))
  }
  return null
}
