// src/pages/ResetPassword.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import logoNavbar from '@/assets/logo-navbar.webp'
import PasswordInput from '@/components/ui/PasswordInput'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    // Supabase établit automatiquement une session temporaire de récupération
    // à partir du lien reçu par email (detectSessionInUrl). updateUser() met
    // à jour le mot de passe pour cette session.
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError("Le lien a peut-être expiré ou n'est plus valide. Redemandez un nouveau lien de réinitialisation.")
      return
    }
    setSuccess(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex"><img src={logoNavbar} alt="Animéaux" className="h-10 w-auto" /></Link>
        </div>
        <div className="card p-8">
          {success ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Mot de passe mis à jour !</h2>
              <p className="text-sm text-gray-500">Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Nouveau mot de passe</h1>
              <p className="text-sm text-gray-500 mb-6">
                Choisissez un nouveau mot de passe pour votre compte.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 8 caractères)"
                  required
                />
                <PasswordInput
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  required
                />
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                <Link to="/forgot-password" className="text-sage-600 hover:underline">
                  Redemander un lien
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
