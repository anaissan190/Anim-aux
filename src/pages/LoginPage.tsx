import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setProfile } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    setUser({ ...data.user, email: data.user.email ?? '', role: userData?.role || 'patient' })
    setProfile(profileData)

   setUser({ ...data.user, email: data.user.email ?? '', role: userData?.role || 'patient' })
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '440px', padding: '0 20px' }}>

        {/* LOGO */}
        <div onClick={() => navigate('/')} style={{ fontFamily: 'Fredoka One, cursive', fontSize: '32px', color: '#C2410C', textAlign: 'center', marginBottom: '8px', cursor: 'pointer' }}>
          Animéaux 🐾
        </div>
        <p style={{ textAlign: 'center', color: '#92400E', fontSize: '14px', marginBottom: '32px' }}>
          Bon retour parmi nous !
        </p>

        {/* CARTE */}
        <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '32px' }}>
          <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '26px', color: '#C2410C', marginBottom: '24px', textAlign: 'center' }}>
            Connexion
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                style={{ width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#1C0A00', outline: 'none', background: '#FFFBF5' }}
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#1C0A00', outline: 'none', background: '#FFFBF5' }}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <span onClick={() => navigate('/forgot-password')} style={{ fontSize: '12px', fontWeight: 700, color: '#F97316', cursor: 'pointer' }}>
                Mot de passe oublié ?
              </span>
            </div>

            {error && (
              <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: loading ? '#FED7AA' : '#F97316', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Connexion...' : 'Se connecter 🐾'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#92400E', marginTop: '20px' }}>
          Pas encore de compte ?{' '}
          <span onClick={() => navigate('/register')} style={{ fontWeight: 800, color: '#F97316', cursor: 'pointer' }}>
            Créer un compte
          </span>
        </p>

      </div>
    </div>
  )
}