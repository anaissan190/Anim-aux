// src/pages/SubscriptionPage.tsx
// « Mon abonnement » (/abonnement) : écran de tarification des offres et point d'entrée du
// paiement. Réservé aux praticiens. Le bouton d'une offre payante envoie vers la page de
// paiement sécurisée Stripe ; au retour (?paiement=succes) l'écran attend la confirmation
// signée de Stripe, qui seule active l'offre (voir supabase/functions/stripe-webhook).
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import { useAuthStore } from '@/lib/authStore'
import {
  useCurrentDoctor, useMyClinic, useDoctorHasPro, useMySubscriptions, useStartCheckout, useOpenBillingPortal,
} from '@/hooks/useData'
import {
  PLAN_OFFERS, PRICE_FOOTNOTE, currentSubscription, describeSubscription, paymentReturnFromSearch, type PlanOffer,
} from '@/lib/subscription'

// Attente maximale de la confirmation de Stripe après un paiement réussi.
const ACTIVATION_WAIT_MS = 60_000

function FeatureList({ offer }: { offer: PlanOffer }) {
  return (
    <ul className="space-y-1.5 text-sm mb-5">
      {offer.features.map(f => (
        <li key={f.label} className={`flex gap-2 ${f.included ? 'text-gray-700' : 'text-gray-300'}`}>
          <span className={f.included ? 'text-moss-700 font-bold' : ''} aria-hidden="true">{f.included ? '✓' : '✕'}</span>
          <span>{f.label}</span>
        </li>
      ))}
    </ul>
  )
}

function PlanCard({ offer, highlighted, children }: { offer: PlanOffer; highlighted?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-3xl overflow-hidden flex flex-col ${highlighted ? 'border-2 border-sage-600 shadow-lg' : 'border border-sand-200'}`}>
      <div className={`px-5 pt-5 pb-4 ${highlighted ? 'bg-sage-600 text-white' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${highlighted ? '' : 'text-gray-500'}`}>{offer.name}</p>
          {highlighted && <span className="text-[11px] font-semibold bg-white text-sage-700 px-2.5 py-0.5 rounded-full">Recommandé</span>}
        </div>
        <p className="font-serif text-3xl font-bold mt-2 leading-none">
          {offer.priceHt ? <>{offer.priceHt} €<span className="font-sans text-sm font-normal"> HT / mois</span></> : '0 €'}
        </p>
        <p className={`text-xs mt-2 ${highlighted ? 'opacity-90' : 'text-gray-500'}`}>{offer.tagline}</p>
      </div>
      <div className="px-5 pt-4 pb-5 flex-1 flex flex-col">
        <FeatureList offer={offer} />
        <div className="mt-auto">{children}</div>
      </div>
    </div>
  )
}

export default function SubscriptionPage() {
  const { user } = useAuthStore()
  const location = useLocation()
  const qc = useQueryClient()
  const returned = paymentReturnFromSearch(location.search)

  const { data: doctor } = useCurrentDoctor()
  const { data: clinic } = useMyClinic(doctor?.id)
  const { data: subscriptions = [] } = useMySubscriptions()

  // Juste après un paiement, on relit l'offre toutes les 3 s (jusqu'à 60 s) en attendant la
  // confirmation de Stripe.
  const deadline = useRef(Date.now() + ACTIVATION_WAIT_MS)
  const [waiting, setWaiting] = useState(returned === 'success')
  const { data: hasPro } = useDoctorHasPro(doctor?.id, waiting ? 3000 : false)
  useEffect(() => {
    if (!waiting) return
    if (hasPro === true) { setWaiting(false); qc.invalidateQueries({ queryKey: ['my-subscriptions'] }); return }
    const t = setTimeout(() => { if (Date.now() >= deadline.current) setWaiting(false) }, ACTIVATION_WAIT_MS)
    return () => clearTimeout(t)
  }, [waiting, hasPro, qc])

  const startCheckout = useStartCheckout()
  const openPortal = useOpenBillingPortal()
  const [accepted, setAccepted] = useState(false)
  const [showCabinetForm, setShowCabinetForm] = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [clinicCity, setClinicCity] = useState('')

  const verified = doctor?.verification_status === 'verified'
  const sub = currentSubscription(subscriptions)
  const isClinicOwner = !!clinic && clinic.owner_id === user?.id
  const individualActive = doctor?.plan === 'pro'
  const clinicActive = clinic?.plan === 'cabinet'
  const canPay = verified && accepted && !startCheckout.isPending

  function goToPayment(plan: 'pro' | 'cabinet') {
    startCheckout.mutate(
      { plan, clinicName: clinicName.trim() || undefined, clinicCity: clinicCity.trim() || undefined },
      { onSuccess: url => { window.location.assign(url) } },
    )
  }

  const status = hasPro ? describeSubscription(subscriptions.length ? sub : null) : null
  const statusTone = status?.tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-moss-50 border-moss-100 text-moss-800'

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <BackButton fallback="/dashboard/doctor" />

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mon abonnement</h1>
          <p className="text-sm text-gray-500 mt-1">Choisissez la formule qui correspond à votre activité. Vous pouvez en changer à tout moment.</p>
        </div>

        {returned === 'success' && (
          <div className={`rounded-2xl border p-4 text-sm mb-6 ${hasPro ? 'bg-moss-50 border-moss-100 text-moss-800' : 'bg-sage-50 border-sage-100 text-sage-800'}`}>
            {hasPro
              ? '✓ Paiement reçu : votre abonnement est actif. Toutes les fonctionnalités sont ouvertes.'
              : waiting
                ? 'Paiement reçu. Activation de votre abonnement en cours, quelques secondes…'
                : "Paiement reçu. L'activation prend plus de temps que prévu : actualisez cette page dans quelques minutes. Votre paiement est bien enregistré."}
          </div>
        )}
        {returned === 'cancelled' && (
          <div className="rounded-2xl border border-sand-200 bg-white p-4 text-sm text-gray-600 mb-6">
            Le paiement a été annulé : rien n&apos;a été débité. Vous pouvez reprendre quand vous voulez.
          </div>
        )}

        {status && (
          <div className={`rounded-2xl border p-5 mb-6 ${statusTone}`}>
            <p className="font-semibold mb-0.5">Votre abonnement</p>
            <p className="text-sm">{status.text}</p>
            {subscriptions.length > 0 && (
              <button onClick={() => openPortal.mutate(undefined, { onSuccess: url => { window.location.assign(url) } })}
                disabled={openPortal.isPending}
                className="btn-secondary text-sm mt-3">
                {openPortal.isPending ? 'Ouverture…' : 'Gérer mon abonnement'}
              </button>
            )}
            {openPortal.error && <p className="text-xs text-red-600 mt-2">{(openPortal.error as Error).message}</p>}
            <p className="text-xs opacity-80 mt-3">Carte, factures et résiliation se gèrent sur le portail sécurisé de paiement.</p>
          </div>
        )}

        {doctor && !verified && (
          <div className="rounded-2xl border border-sage-100 bg-sage-50 p-4 text-sm text-sage-800 mb-6">
            L&apos;abonnement est proposé dès que votre dossier est validé par notre équipe : vous ne payez jamais avant.
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          <PlanCard offer={PLAN_OFFERS.free}>
            <p className="text-center text-sm text-gray-400 py-2.5">{hasPro ? 'Offre de départ' : 'Votre offre actuelle'}</p>
          </PlanCard>

          <PlanCard offer={PLAN_OFFERS.pro} highlighted>
            {individualActive ? (
              <p className="text-center text-sm font-medium text-moss-700 py-2.5">✓ Votre offre actuelle</p>
            ) : (
              <button className="btn-primary w-full" disabled={!canPay || clinicActive}
                onClick={() => goToPayment('pro')}>
                {startCheckout.isPending ? 'Redirection…' : "Choisir l'abonnement"}
              </button>
            )}
            {clinicActive && !individualActive && (
              <p className="text-xs text-gray-400 text-center mt-2">Votre cabinet est déjà abonné.</p>
            )}
          </PlanCard>

          <PlanCard offer={PLAN_OFFERS.cabinet}>
            {clinicActive ? (
              <p className="text-center text-sm font-medium text-moss-700 py-2.5">✓ Offre actuelle de votre cabinet</p>
            ) : clinic && !isClinicOwner ? (
              <p className="text-xs text-gray-500 text-center">Seul le créateur du cabinet peut activer l&apos;abonnement cabinet.</p>
            ) : showCabinetForm && !clinic ? (
              <div className="space-y-2">
                <input className="input text-sm" placeholder="Nom du cabinet" value={clinicName}
                  onChange={e => setClinicName(e.target.value)} />
                <input className="input text-sm" placeholder="Ville (facultatif)" value={clinicCity}
                  onChange={e => setClinicCity(e.target.value)} />
                <button className="btn-primary w-full" disabled={!canPay || !clinicName.trim()}
                  onClick={() => goToPayment('cabinet')}>
                  {startCheckout.isPending ? 'Redirection…' : 'Continuer vers le paiement'}
                </button>
              </div>
            ) : (
              <button className="btn-secondary w-full" disabled={!verified || (!!clinic && !canPay)}
                onClick={() => (clinic ? goToPayment('cabinet') : setShowCabinetForm(true))}>
                {startCheckout.isPending ? 'Redirection…' : "Choisir l'abonnement cabinet"}
              </button>
            )}
          </PlanCard>
        </div>

        <div className="max-w-xl mx-auto mt-6">
          <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500" />
            <span>
              J&apos;ai lu et j&apos;accepte les{' '}
              <Link to="/cgu" target="_blank" className="text-sage-600 font-medium hover:underline">conditions générales</Link>{' '}
              applicables à l&apos;abonnement.
            </span>
          </label>
          {startCheckout.error && <p className="text-sm text-red-600 mt-3">{(startCheckout.error as Error).message}</p>}
          <p className="text-xs text-gray-400 mt-4 text-center">{PRICE_FOOTNOTE}</p>
        </div>
      </div>
    </div>
  )
}
