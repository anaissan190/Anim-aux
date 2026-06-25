// src/pages/RegisterPage.tsx
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { PRACTITIONER_TYPES } from '@/lib/practitionerTypes'

const schema = z.object({
  first_name:        z.string().min(2, 'Prénom requis'),
  last_name:         z.string().min(2, 'Nom requis'),
  email:             z.string().email('Email invalide'),
  password:          z.string().min(8, 'Minimum 8 caractères'),
  role:              z.enum(['patient', 'doctor']),
  practitioner_type: z.string().optional(),
})

export default function RegisterPage() {
  const navigate   = useNavigate()
  const [params]   = useSearchParams()
  const defaultRole = params.get('role') === 'doctor' ? 'doctor' : 'patient'

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    role: defaultRole as 'patient' | 'doctor',
    practitioner_type: '',
  })
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [globalError, setGlobalError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError('')

    if (form.role === 'doctor' && !form.practitioner_type) {
      setErrors({ practitioner_type: 'Veuillez choisir votre type de profession' })
      return
    }

    const result = schema.safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.errors.forEach(e => { errs[e.path[0]] = e.message })
      setErrors(errs); return
    }

    setLoading(true)
    const selectedType = PRACTITIONER_TYPES.find(p => p.id === form.practitioner_type)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name:        form.first_name,
          last_name:         form.last_name,
          role:              form.role,
          specialty:         selectedType?.label ?? '',
          practitioner_type: form.practitioner_type,
        }
      }
    })
    setLoading(false)
    if (error) { setGlobalError(error.message); return }
    setSuccess(true)
  }

  if (success) return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4">
      <div className="card p-10 text-center max-w-md w-full">
        <div className="text-5xl mb-4">📬</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h2>
        <p className="text-gray-500 text-sm mb-6">
          Un lien de confirmation a été envoyé à <strong>{form.email}</strong>.
          Cliquez dessus pour activer votre compte.
        </p>
        <Link to="/login" className="btn-primary inline-block">Aller à la connexion</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-sage-600">🌿 Animéaux</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-4">Créer un compte</h1>
        </div>
        <div className="card p-8">

          {/* Type de compte */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            {(['patient', 'doctor'] as const).map(r => (
              <button key={r} type="button"
                onClick={() => setForm(f => ({ ...f, role: r, practitioner_type: '' }))}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                  ${form.role === r ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
                {r === 'patient' ? '🙋 Propriétaire' : '🩺 Praticien'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  className="input" placeholder="Marie" />
                {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  className="input" placeholder="Dupont" />
                {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
              </div>
            </div>

            {/* Choix du type de praticien */}
            {form.role === 'doctor' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Votre profession
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {PRACTITIONER_TYPES.map(type => (
                    <button key={type.id} type="button"
                      onClick={() => setForm(f => ({ ...f, practitioner_type: type.id }))}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors
                        ${form.practitioner_type === type.id
                          ? 'border-sage-500 bg-sage-50 text-sage-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <span className="text-xl">{type.icon}</span>
                      <span>{type.label}</span>
                      {form.practitioner_type === type.id && <span className="ml-auto text-sage-500">✓</span>}
                    </button>
                  ))}
                </div>
                {errors.practitioner_type && (
                  <p className="text-red-500 text-xs mt-1">{errors.practitioner_type}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input" placeholder="vous@email.fr" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input" placeholder="Minimum 8 caractères" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {globalError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                {globalError}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-sage-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
