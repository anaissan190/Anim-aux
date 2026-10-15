// src/pages/CabinetQuotePage.tsx
// Questionnaire « Grand cabinet » (/devis-cabinet) : pour plus de 5 praticiens, pas de tarif
// publié. La demande part par la fonction Edge request-cabinet-quote (validation, emails) ;
// Anaïs envoie ensuite son devis par email. Réservé aux praticiens connectés (pas de captcha
// nécessaire). Décidé le 15/10/2026.
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import { useAuthStore } from '@/lib/authStore'
import { useCurrentDoctor, useMyClinic, useRequestCabinetQuote } from '@/hooks/useData'
import { QUOTE_ERRORS, validateQuoteRequest } from '@/lib/cabinetQuote'

export default function CabinetQuotePage() {
  const { user } = useAuthStore()
  const { data: doctor } = useCurrentDoctor()
  const { data: clinic } = useMyClinic(doctor?.id)
  const send = useRequestCabinetQuote()

  const [clinicName, setClinicName] = useState('')
  const [city, setCity] = useState('')
  const [count, setCount] = useState('')
  const [nextYear, setNextYear] = useState('')
  const [secretaries, setSecretaries] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const consentRef = useRef<HTMLInputElement>(null)

  // Pré-remplit avec le cabinet du praticien, sans écraser ce qu'il a déjà tapé.
  const nameValue = clinicName || clinic?.name || ''
  const cityValue = city || clinic?.city || ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const input = {
      clinicName: nameValue, city: cityValue, practitionerCount: count, practitionerCountNextYear: nextYear,
      secretaryCount: secretaries, phone, message, consent,
    }
    const check = validateQuoteRequest(input)
    if (!check.ok) {
      setError(QUOTE_ERRORS[check.error])
      if (check.error === 'consent_required') {
        consentRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
        consentRef.current?.focus()
      }
      return
    }
    send.mutate(input, {
      onSuccess: () => setSent(true),
      onError: err => setError((err as Error).message),
    })
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#FFFAF0]">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-12 text-center">
          <div className="card p-8">
            <p className="text-4xl mb-3" aria-hidden="true">✉️</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Demande envoyée</h1>
            <p className="text-sm text-gray-600 mb-1">
              Merci ! Nous étudions votre situation et revenons vers vous par email avec un devis adapté à la taille de votre équipe.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Un accusé de réception a été envoyé à {user?.email ?? 'votre adresse'}. Aucun paiement n&apos;est demandé d&apos;ici là.
            </p>
            <Link to="/dashboard/doctor" className="btn-primary inline-block">Retour à mon espace</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <BackButton fallback="/abonnement" />

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Devis pour un grand cabinet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Au-delà de 5 praticiens, le prix est fixé avec vous. Répondez à quelques questions : nous vous envoyons un devis par email.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="card p-6 space-y-4">
          <div>
            <label htmlFor="q-name" className="label">Nom du cabinet</label>
            <input id="q-name" className="input" value={nameValue} onChange={e => setClinicName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label htmlFor="q-city" className="label">Ville <span className="text-gray-400 font-normal">(facultatif)</span></label>
            <input id="q-city" className="input" value={cityValue} onChange={e => setCity(e.target.value)} maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="q-count" className="label">Praticiens aujourd&apos;hui</label>
              <input id="q-count" className="input" inputMode="numeric" placeholder="Ex. 8" value={count} onChange={e => setCount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="q-next" className="label">Dans un an <span className="text-gray-400 font-normal">(facultatif)</span></label>
              <input id="q-next" className="input" inputMode="numeric" placeholder="Ex. 10" value={nextYear} onChange={e => setNextYear(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="q-sec" className="label">Personnes au secrétariat <span className="text-gray-400 font-normal">(facultatif)</span></label>
            <input id="q-sec" className="input" inputMode="numeric" placeholder="Ex. 2" value={secretaries} onChange={e => setSecretaries(e.target.value)} />
          </div>
          <div>
            <label htmlFor="q-phone" className="label">Téléphone <span className="text-gray-400 font-normal">(facultatif)</span></label>
            <input id="q-phone" className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="q-msg" className="label">Un message ? <span className="text-gray-400 font-normal">(facultatif)</span></label>
            <textarea id="q-msg" className="input min-h-[96px]" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000}
              placeholder="Votre organisation, vos attentes, plusieurs sites…" />
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
              <input ref={consentRef} type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError('') }}
                className="mt-0.5 h-4 w-4 rounded text-sage-600 focus:ring-sage-500 border-gray-300" />
              <span>
                J&apos;accepte que ces informations soient utilisées pour me répondre (voir la{' '}
                <Link to="/confidentialite" target="_blank" className="text-sage-600 font-medium hover:underline">politique de confidentialité</Link>).
              </span>
            </label>
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={send.isPending}>
            {send.isPending ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Nous vous répondons à {user?.email ?? 'votre adresse email'}. Aucun paiement n&apos;est demandé.
          </p>
        </form>
      </div>
    </div>
  )
}
