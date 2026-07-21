// src/pages/ForgotPassword.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import logoNavbar from '@/assets/logo-navbar.svg'
import Turnstile from '@/components/ui/Turnstile'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      captchaToken,
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex"><img src={logoNavbar} alt="Animéaux" className="h-10 w-auto" /></Link>
        </div>
        <div className="card p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Email envoyé !</h2>
              <p className="text-sm text-gray-500 mb-6">
                Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
              </p>
              <Link to="/login" className="btn-primary inline-block">Retour à la connexion</Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
              <p className="text-sm text-gray-500 mb-6">
                Entrez votre email et nous vous enverrons un lien de réinitialisation.
              </p>
              <form onSubmit={handle} className="space-y-4">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input" placeholder="vous@email.fr" required />
                <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                <Link to="/login" className="text-sage-600 hover:underline">← Retour</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
