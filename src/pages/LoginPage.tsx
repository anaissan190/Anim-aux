import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, getMyUserDataWithRetry } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'
import type { User } from '@/types'
import logoNavbar from '@/assets/logo-navbar.svg'
import PasswordInput from '@/components/ui/PasswordInput'
import Turnstile from '@/components/ui/Turnstile'

// Un compte secrétariat se connecte avec un identifiant généré (ex.
// CAB4X9QZ), pas avec un email — doit rester synchronisé avec
// SECRETARY_AUTH_DOMAIN dans supabase/functions/invite-clinic-secretary.
// Sans "@" dans la saisie, on reconstruit l'email synthétique attendu par
// Supabase Auth avant de tenter la connexion.
const SECRETARY_AUTH_DOMAIN = 'secretariat.animeaux.internal'
function resolveLoginEmail(input: string) {
  const trimmed = input.trim()
  return trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase()}@${SECRETARY_AUTH_DOMAIN}`
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser, setProfile } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const suspendedReason = searchParams.get('suspended') ? searchParams.get('reason') : null
  const [error, setError] = useState(
    searchParams.get('suspended')
      ? `Ce compte a été suspendu.${suspendedReason ? ` Motif : ${suspendedReason}.` : ''} Contactez-nous si vous pensez qu'il s'agit d'une erreur.`
      : ''
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let data: any, authError: any
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: resolveLoginEmail(email), password, options: { captchaToken } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connexion Supabase')), 10000))
      ]) as any
      data = result.data
      authError = result.error
    } catch (e: any) {
      setError(`Erreur réseau : ${e.message}`)
      setLoading(false)
      return
    }

    if (authError) {
      // Un token Turnstile déjà utilisé (nouvelle tentative après une
      // première erreur) ou expiré (formulaire rempli trop lentement) est
      // rejeté par Supabase avec une erreur captcha — sans ce cas séparé,
      // le message générique ci-dessous affichait à tort "mot de passe
      // incorrect" alors que le mot de passe n'était jamais vérifié.
      const msg = authError.message?.toLowerCase() ?? ''
      const emailNotConfirmed = authError.code === 'email_not_confirmed' || msg.includes('email not confirmed')
      const captchaFailed = authError.code === 'captcha_failed' || msg.includes('captcha')
      if (emailNotConfirmed) {
        setError('Veuillez confirmer votre adresse email en cliquant sur le lien reçu par email avant de vous connecter.')
      } else if (captchaFailed) {
        setError('Vérification anti-robot expirée, merci de réessayer.')
      } else if (msg.includes('rate limit') || msg.includes('too many requests')) {
        setError('Trop de tentatives, merci de patienter quelques minutes avant de réessayer.')
      } else {
        setError('Email ou mot de passe incorrect')
      }
      // Un token Turnstile est à usage unique : on force le widget à se
      // recréer (via sa key) pour que la prochaine tentative en obtienne un
      // nouveau, sinon toute nouvelle soumission échouerait systématiquement
      // avec l'erreur captcha ci-dessus, quel que soit le mot de passe saisi.
      setCaptchaToken('')
      setTurnstileKey(k => k + 1)
      setLoading(false)
      return
    }

    if (data.user) {
      const fallbackUser: User = { id: data.user.id, email: data.user.email!, role: 'patient', is_admin: false, created_at: '' }
      let finalUser: User = fallbackUser

      const userData = await getMyUserDataWithRetry()
      if (userData?.is_suspended) {
        await supabase.auth.signOut()
        setError(`Ce compte a été suspendu.${userData.suspended_reason ? ` Motif : ${userData.suspended_reason}.` : ''} Contactez-nous si vous pensez qu'il s'agit d'une erreur.`)
        setCaptchaToken('')
        setTurnstileKey(k => k + 1)
        setLoading(false)
        return
      }
      if (userData) {
        finalUser = { ...fallbackUser, role: userData.role ?? 'patient', is_admin: userData.is_admin ?? false }
        setUser(finalUser)
        setProfile(userData.profile ?? null)
      } else {
        setUser(fallbackUser)
        setProfile(null)
      }

      await new Promise(r => setTimeout(r, 100))

      // Un compte is_admin sans usage praticien/patient réel (ex.
      // contact.animeaux@gmail.com, dédié à l'administration) va
      // directement sur le tableau de bord admin plutôt que sur le
      // dashboard associé à son role technique ('patient' par défaut).
      if (finalUser.is_admin) {
        navigate('/dashboard/admin', { replace: true })
      } else if (finalUser.role === 'doctor') {
        navigate('/dashboard/doctor', { replace: true })
      } else if (finalUser.role === 'secretary') {
        navigate('/dashboard/secretariat', { replace: true })
      } else {
        navigate('/dashboard/patient', { replace: true })
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex"><img src={logoNavbar} alt="Animéaux" className="h-10 w-auto" /></Link>
          <h1 className="text-xl font-bold text-gray-900 mt-4">Connexion</h1>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email ou identifiant</label>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="vous@email.fr" required autoCapitalize="none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-sage-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <Turnstile key={turnstileKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-sage-600 font-medium hover:underline">S'inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
