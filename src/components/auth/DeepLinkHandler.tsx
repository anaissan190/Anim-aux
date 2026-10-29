// src/components/auth/DeepLinkHandler.tsx
// Dans l'application native uniquement : reçoit les liens d'email
// (fr.monanimeaux.app://…) et établit la session, comme detectSessionInUrl le
// fait sur le web. Ne rend rien.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'
import { isNativeApp } from '@/lib/nativeApp'
import { parseAuthDeepLink } from '@/lib/authDeepLink'

export default function DeepLinkHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeApp()) return

    async function handle(url: string) {
      const link = parseAuthDeepLink(url)
      if (!link) return

      if (link.kind === 'error') {
        showToast(link.message)
        navigate(link.flow === 'recovery' ? '/forgot-password' : '/login', { replace: true })
        return
      }

      // Récupération de mot de passe : on se rend d'abord sur /reset-password,
      // car App.tsx y ignore la session de récupération (jamais une connexion
      // normale) — l'inverse ferait « connecter » l'utilisateur au compte.
      if (link.flow === 'recovery') navigate('/reset-password', { replace: true })

      const { error } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      })
      if (error) {
        showToast("Ce lien n'est plus valide. Demandez-en un nouveau.")
        navigate(link.flow === 'recovery' ? '/forgot-password' : '/login', { replace: true })
        return
      }
      if (link.flow === 'signup') navigate('/', { replace: true })
    }

    const listener = CapacitorApp.addListener('appUrlOpen', e => { void handle(e.url) })
    // Application fermée au moment du clic : le lien est le point de lancement.
    void CapacitorApp.getLaunchUrl().then(r => { if (r?.url) void handle(r.url) })

    return () => { void listener.then(h => h.remove()) }
  }, [navigate])

  return null
}
