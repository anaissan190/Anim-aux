// src/pages/ConfirmPresencePage.tsx
// Page publique liée depuis le rappel de RDV à 24h (email). Volontairement
// hors ProtectedRoute : cliquée depuis un client mail, souvent sans
// session active sur cet appareil — voir confirm-appointment-presence.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import logoNavbar from '@/assets/logo-navbar.webp'

type State =
  | { step: 'loading' }
  | { step: 'success'; doctorName: string; dateStr: string }
  | { step: 'error'; reason: string; doctorName?: string; dateStr?: string }

export default function ConfirmPresencePage() {
  const { id } = useParams()
  const [state, setState] = useState<State>({ step: 'loading' })

  useEffect(() => {
    if (!id) { setState({ step: 'error', reason: 'missing_id' }); return }
    let cancelled = false
    supabase.functions.invoke('confirm-appointment-presence', { body: { appointmentId: id } })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.ok) {
          setState({ step: 'error', reason: data?.reason ?? 'unknown', doctorName: data?.doctorName, dateStr: data?.dateStr })
        } else {
          setState({ step: 'success', doctorName: data.doctorName, dateStr: data.dateStr })
        }
      })
      .catch(() => { if (!cancelled) setState({ step: 'error', reason: 'unknown' }) })
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-flex mb-8"><img src={logoNavbar} alt="Animéaux" className="h-10 w-auto" /></Link>
        <div className="card p-8">
          {state.step === 'loading' && (
            <p className="text-gray-500 text-sm">Confirmation en cours...</p>
          )}
          {state.step === 'success' && (
            <>
              <div className="text-4xl mb-3">✅</div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">Présence confirmée</h1>
              <p className="text-sm text-gray-600">
                Merci ! {state.doctorName || 'Votre praticien'} sait que vous serez présent(e){state.dateStr ? <> le<br /><strong>{state.dateStr}</strong></> : ''}.
              </p>
            </>
          )}
          {state.step === 'error' && state.reason === 'not_confirmable' && (
            <>
              <div className="text-4xl mb-3">ℹ️</div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">Rendez-vous non confirmable</h1>
              <p className="text-sm text-gray-600">
                Ce rendez-vous a déjà eu lieu ou n'est plus confirmé. Si besoin, gérez vos rendez-vous depuis votre espace.
              </p>
              <Link to="/rendez-vous" className="btn-primary inline-block mt-4 text-sm">Mes rendez-vous</Link>
            </>
          )}
          {state.step === 'error' && state.reason !== 'not_confirmable' && (
            <>
              <div className="text-4xl mb-3">⚠️</div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">Lien invalide</h1>
              <p className="text-sm text-gray-600">
                Ce lien de confirmation n'est plus valide. Connectez-vous à votre espace pour gérer vos rendez-vous.
              </p>
              <Link to="/login" className="btn-primary inline-block mt-4 text-sm">Se connecter</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
