// src/pages/QuotePaymentPage.tsx
// Page de paiement d'un devis « grand cabinet » (/paiement-devis/<jeton>) : le lien que
// l'admin joint à son devis. Réservée au praticien connecté qui a fait la demande (la base ne
// lui renvoie que sa demande). Un clic sur « Payer par carte » crée la page de paiement
// Stripe au prix du devis (fonction create-quote-checkout) ; l'offre ne s'active que sur
// confirmation signée de Stripe (webhook).
import { useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import { useQuoteOffer, useStartQuoteCheckout } from '@/hooks/useData'
import { CONTACT_EMAIL } from '@/lib/doctorPlan'
import { formatCents } from '@/lib/quotePrice'
import { PLAN_OFFERS, TERMS_REQUIRED_MESSAGE, billingErrorMessage, paymentReturnFromSearch } from '@/lib/subscription'

export default function QuotePaymentPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const { data: offer, isLoading, error } = useQuoteOffer(token)
  const start = useStartQuoteCheckout()
  const [accepted, setAccepted] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const termsRef = useRef<HTMLInputElement>(null)
  const cancelled = paymentReturnFromSearch(location.search) === 'cancelled'

  function pay() {
    if (!accepted) {
      setTermsError(true)
      termsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      termsRef.current?.focus()
      return
    }
    start.mutate({ token: token! }, { onSuccess: url => { window.location.assign(url) } })
  }

  let body: React.ReactNode
  if (isLoading) {
    body = <p className="text-sm text-gray-400 text-center">Chargement...</p>
  } else if (error) {
    body = <p className="text-sm text-red-600 text-center">Impossible de charger ce devis pour le moment. Réessayez dans un instant.</p>
  } else if (!offer) {
    body = (
      <div className="card p-6 text-center">
        <p className="text-sm text-gray-700 mb-2">{billingErrorMessage('not_your_quote')}</p>
        <p className="text-xs text-gray-400">Besoin d&apos;aide ? Écrivez-nous à {CONTACT_EMAIL}.</p>
      </div>
    )
  } else if (offer.paid_at) {
    body = (
      <div className="card p-6 text-center">
        <p className="text-sm text-gray-700 mb-4">{billingErrorMessage('already_paid')}</p>
        <Link to="/abonnement" className="btn-primary inline-block">Voir mon abonnement</Link>
      </div>
    )
  } else if (!offer.offer_price_cents || !offer.offer_max_practitioners) {
    body = (
      <div className="card p-6 text-center">
        <p className="text-sm text-gray-700 mb-2">{billingErrorMessage('link_disabled')}</p>
        <p className="text-xs text-gray-400">{CONTACT_EMAIL}</p>
      </div>
    )
  } else {
    body = (
      <div className="card p-6">
        <p className="text-sm text-gray-500">{PLAN_OFFERS.custom.name} — {offer.clinic_name}</p>
        <p className="font-serif text-3xl font-bold mt-2 leading-none">
          {formatCents(offer.offer_price_cents)}<span className="font-sans text-sm font-normal"> HT / mois</span>
        </p>
        <p className="text-sm text-gray-600 mt-2">Pour un cabinet de {offer.offer_max_practitioners} praticiens au plus.</p>

        <ul className="space-y-1.5 text-sm my-5">
          {PLAN_OFFERS.custom.features.filter(f => f.included).map(f => (
            <li key={f.label} className="flex gap-2 text-gray-700">
              <span className="text-moss-700 font-bold" aria-hidden="true">✓</span>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer mb-1">
          <input ref={termsRef} type="checkbox" checked={accepted}
            onChange={e => { setAccepted(e.target.checked); if (e.target.checked) setTermsError(false) }}
            aria-invalid={termsError && !accepted}
            className={`mt-0.5 h-4 w-4 rounded text-sage-600 focus:ring-sage-500 ${termsError && !accepted ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'}`} />
          <span>
            J&apos;ai lu et j&apos;accepte les{' '}
            <Link to="/cgu" target="_blank" className="text-sage-600 font-medium hover:underline">conditions générales</Link>{' '}
            applicables à l&apos;abonnement et le devis reçu.
          </span>
        </label>
        {termsError && !accepted && <p role="alert" className="text-sm text-red-600 mb-2">{TERMS_REQUIRED_MESSAGE}</p>}

        <button className="btn-primary w-full mt-3" disabled={start.isPending} onClick={pay}>
          {start.isPending ? 'Redirection…' : 'Payer par carte'}
        </button>
        {start.error && <p role="alert" className="text-sm text-red-600 mt-3">{(start.error as Error).message}</p>}
        <p className="text-xs text-gray-400 mt-4 text-center">
          Prix mensuels hors taxes. Paiement sécurisé par Stripe. Résiliable à tout moment : l&apos;abonnement reste actif jusqu&apos;à la fin de la période payée.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Votre abonnement Grand cabinet</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Le prix convenu dans votre devis.</p>
        {cancelled && (
          <div className="rounded-2xl border border-sand-200 bg-white p-4 text-sm text-gray-600 mb-4">
            Le paiement a été annulé : rien n&apos;a été débité. Vous pouvez reprendre quand vous voulez.
          </div>
        )}
        {body}
      </div>
    </div>
  )
}
