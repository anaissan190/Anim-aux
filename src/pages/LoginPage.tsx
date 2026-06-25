import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setProfile } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let data: any, authError: any
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
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
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: userData } = await supabase
        .from('users').select('*').eq('id', data.user.id).single()

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('user_id', data.user.id).single()

      const finalUser = userData ?? { id: data.user.id, email: data.user.email!, role: 'patient', created_at: '' }
      
      setUser(finalUser)
      setProfile(profileData ?? null)

      await new Promise(r => setTimeout(r, 100))

      if (finalUser.role === 'doctor') {
        navigate('/dashboard/doctor', { replace: true })
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
          <Link to="/" className="text-2xl font-bold text-sage-600">🐾 Animéaux</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-4">Connexion</h1>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="vous@email.fr" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" required />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-sage-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
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
