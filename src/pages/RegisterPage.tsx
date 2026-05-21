import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } }
    })

    if (err) { setError(err.message); setLoading(false); return }
    navigate('/login')
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
          Rejoignez des milliers de propriétaires !
        </p>

        {/* CARTE */}
        <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '20px', padding: '32px' }}>
          <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '26px', color: '#C2410C', marginBottom: '24px', textAlign: 'center' }}>
            Créer un compte
          </h2>

          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Anaïs"
                  required
                  style={{ width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#1C0A00', outline: 'none', background: '#FFFBF5' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Dupont"
                  required
                  style={{ width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#1C0A00', outline: 'none', background: '#FFFBF5' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                style={{ width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#1C0A00', outline: 'none', background: '#FFFBF5' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '12px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#1C0A00', outline: 'none', background: '#FFFBF5' }}
              />
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
              {loading ? 'Création...' : 'Créer mon compte 🐾'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#92400E', marginTop: '20px' }}>
          Déjà un compte ?{' '}
          <span onClick={() => navigate('/login')} style={{ fontWeight: 800, color: '#F97316', cursor: 'pointer' }}>
            Se connecter
          </span>
        </p>

      </div>
    </div>
  )
}