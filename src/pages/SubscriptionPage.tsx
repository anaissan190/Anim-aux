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
import { LARGE_CABINET_MAILTO } from '@/lib/doctorPlan'
import {
  useCurrentDoctor, useMyClinic, useDoctorHasPro, useMySubscriptions, useStartCheckout, useOpenBillingPortal,
} from '@/hooks/useData'
import {
  PLAN_OFFERS, PRICE_FOOTNOTE, TERMS_REQUIRED_MESSAGE, currentSubscription, describeSubscription, freePlanState, paymentReturnFromSearch, type PlanOffer,
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

// `highlighted` : la carte est en orange, seulement quand la personne la survole, la sélectionne
// au clavier ou la touche. Aucune offre n'est mise en avant par défaut et aucune n'est
// « recommandée » : on ne connaît pas la situation du praticien (seul ou en équipe).
function PlanCard({ offer, highlighted, onActivate, children }: {
  offer: PlanOffer; highlighted?: boolean; onActivate?: () => void; children?: React.ReactNode
}) {
  return (
    <div data-plan={offer.id} data-highlighted={highlighted ? 'true' : 'false'}
      onMouseEnter={onActivate} onFocus={onActivate} onClick={onActivate}
      className={`bg-white rounded-3xl overflow-hidden flex flex-col transition-all duration-200
        ${highlighted ? 'border-2 border-sage-600 shadow-lg' : 'border-2 border-transparent outline outline-1 outline-sand-200'}`}>
      <div className={`px-5 pt-5 pb-4 transition-colors duration-200 ${highlighted ? 'bg-sage-600 text-white' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${highlighted ? '' : 'text-gray-500'}`}>{offer.name}</p>
        </div>
        <p className="font-serif text-3xl font-bold mt-2 leading-none">
          {offer.priceLabel ?? (offer.priceHt ? <>{offer.priceHt} €<span className="font-sans text-sm font-normal"> HT / mois</span></> : '0 €')}
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
  // Clic sur « Choisir… » sans avoir coché les conditions : on l'explique à côté de la case.
  const [termsError, setTermsError] = useState(false)
  const termsRef = useRef<HTMLInputElement>(null)
  // Offre payante survolée / sélectionnée : seule celle-là passe en orange.
  const [active, setActive] = useState<'pro' | 'cabinet' | 'custom' | null>(null)
  const [showCabinetForm, setShowCabinetForm] = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [clinicCity, setClinicCity] = useState('')

  const verified = doctor?.verification_status === 'verified'
  const sub = currentSubscription(subscriptions)
  const isClinicOwner = !!clinic && clinic.owner_id === user?.id
  const individualActive = doctor?.plan === 'pro'
  const clinicActive = clinic?.plan === 'cabinet'
  const canStart = verified && !startCheckout.isPending

  // Les boutons restent cliquables sans acceptation : au lieu d'être grisés sans explication,
  // ils renvoient vers la case des conditions avec un message.
  function requireTerms(): boolean {
    if (accepted) return true
    setTermsError(true)
    termsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    termsRef.current?.focus()
    return false
  }

  function goToPayment(plan: 'pro' | 'cabinet') {
    if (!requireTerms()) return
    startCheckout.mutate(
      { plan, clinicName: clinicName.trim() || undefined, clinicCity: clinicCity.trim() || undefined },
      { onSuccess: url => { window.location.assign(url) } },
    )
  }

  const freeState = freePlanState(hasPro, sub)
  const status = hasPro ? describeSubscription(subscriptions.length ? sub : null) : null
  const statusTone = status?.tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-moss-50 border-moss-100 text-moss-800'

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <BackButton fallback="/dashboard/doctor" />

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mon abonnement</h1>
          <p className="text-sm text-gray-500 mt-1">Choisissez la formule qui correspond à votre activité. Vous pouvez en changer à tout moment.</p>
        </div>

        {returned === 'success' && (
          <div className={`rounded-2xl border p-4 text-sm mb-6 ${hasPro ? 'bg-moss-50 border-moss-100 text-moss-800' : 'bg-sage-50 border-sage-100 text-sage-800'}`}>
            {hasPro
              ? (
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span>✓ Paiement reçu : votre abonnement est actif. Toutes les fonctionnalités sont ouvertes.</span>
                  <Link to="/dashboard/doctor" className="bg-moss-600 hover:bg-moss-700 text-white rounded-full px-4 py-1.5 text-sm font-medium">
                    Découvrir mon espace
                  </Link>
                </span>
              )
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

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          <PlanCard offer={PLAN_OFFERS.free}>
            {freeState.kind === 'current' && <p className="text-center text-sm text-gray-400 py-2.5">Votre offre actuelle</p>}
            {freeState.kind === 'granted' && <p className="text-center text-sm text-gray-400 py-2.5">Offre de départ</p>}
            {freeState.kind === 'downgrade' && (
              <>
                <button className="btn-secondary w-full" disabled={openPortal.isPending}
                  onClick={() => openPortal.mutate(undefined, { onSuccess: url => { window.location.assign(url) } })}>
                  {openPortal.isPending ? 'Ouverture…' : "Revenir à l'offre gratuite"}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Vous gardez toutes les fonctionnalités jusqu&apos;à la fin de la période déjà payée. Rien n&apos;est remboursé au prorata.
                </p>
              </>
            )}
            {freeState.kind === 'scheduled' && (
              <p className="text-center text-sm text-amber-700 py-2.5">
                Retour à l&apos;offre gratuite prévu{freeState.until ? ` le ${freeState.until}` : ' à la fin de la période payée'}.
              </p>
            )}
          </PlanCard>

          <PlanCard offer={PLAN_OFFERS.pro} highlighted={active === 'pro'} onActivate={() => setActive('pro')}>
            {individualActive ? (
              <p className="text-center text-sm font-medium text-moss-700 py-2.5">✓ Votre offre actuelle</p>
            ) : (
              <button className={`${active === 'pro' ? 'btn-primary' : 'btn-secondary'} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={!canStart || clinicActive}
                onClick={() => goToPayment('pro')}>
                {startCheckout.isPending ? 'Redirection…' : "Choisir l'abonnement"}
              </button>
            )}
            {clinicActive && !individualActive && (
              <p className="text-xs text-gray-400 text-center mt-2">Votre cabinet est déjà abonné.</p>
            )}
          </PlanCard>

          <PlanCard offer={PLAN_OFFERS.cabinet} highlighted={active === 'cabinet'} onActivate={() => setActive('cabinet')}>
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
                <button className="btn-primary w-full" disabled={!canStart || !clinicName.trim()}
                  onClick={() => goToPayment('cabinet')}>
                  {startCheckout.isPending ? 'Redirection…' : 'Continuer vers le paiement'}
                </button>
              </div>
            ) : (
              <button className={`${active === 'cabinet' ? 'btn-primary' : 'btn-secondary'} w-full disabled:opacity-50 disabled:cursor-not-allowed`} disabled={!canStart}
                onClick={() => {
                  if (!requireTerms()) return
                  if (!clinic) { setShowCabinetForm(true); return }
                  goToPayment('cabinet')
                }}>
                {startCheckout.isPending ? 'Redirection…' : "Choisir l'abonnement cabinet"}
              </button>
            )}
          </PlanCard>

          <PlanCard offer={PLAN_OFFERS.custom} highlighted={active === 'custom'} onActivate={() => setActive('custom')}>
            <a href={LARGE_CABINET_MAILTO}
              className={`${active === 'custom' ? 'btn-primary' : 'btn-secondary'} block w-full text-center`}>
              Nous contacter
            </a>
            <p className="text-xs text-gray-500 text-center mt-2">Écrivez-nous : nous fixons le prix ensemble.</p>
          </PlanCard>
        </div>

        <div className="max-w-xl mx-auto mt-6">
          <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
            <input ref={termsRef} type="checkbox" checked={accepted}
              onChange={e => { setAccepted(e.target.checked); if (e.target.checked) setTermsError(false) }}
              aria-invalid={termsError && !accepted} aria-describedby={termsError && !accepted ? 'terms-error' : undefined}
              className={`mt-0.5 h-4 w-4 rounded text-sage-600 focus:ring-sage-500 ${termsError && !accepted ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'}`} />
            <span>
              J&apos;ai lu et j&apos;accepte les{' '}
              <Link to="/cgu" target="_blank" className="text-sage-600 font-medium hover:underline">conditions générales</Link>{' '}
              applicables à l&apos;abonnement.
            </span>
          </label>
          {termsError && !accepted && (
            <p id="terms-error" role="alert" className="text-sm text-red-600 mt-2">{TERMS_REQUIRED_MESSAGE}</p>
          )}
          {startCheckout.error && <p className="text-sm text-red-600 mt-3">{(startCheckout.error as Error).message}</p>}
          <p className="text-xs text-gray-400 mt-4 text-center">{PRICE_FOOTNOTE}</p>
        </div>
      </div>
    </div>
  )
}
