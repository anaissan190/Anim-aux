// supabase/functions/stripe-webhook/index.ts
// Reçoit les événements de Stripe (abonnement créé / mis à jour / terminé) et recopie
// l'état dans la base via apply_subscription_state — la SEULE voie qui active ou retire
// une offre payante. Appelée par Stripe, pas par le navigateur : pas de JWT (voir
// supabase/config.toml), l'authenticité vient de la signature `Stripe-Signature`.
//
// Réponse 200 = événement traité ou volontairement ignoré ; 4xx = signature invalide ;
// 5xx = échec de traitement, Stripe réessaie plusieurs fois.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUBSCRIPTION_EVENTS, extractSubscriptionState, isPaidStatus, verifyStripeSignature } from '../_shared/billing.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  // trim : un espace ou un retour à la ligne copié avec le secret suffit à faire refuser toutes les signatures
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim()
  if (!secret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET manquant')
    return json({ ok: false, error: 'not_configured' }, 503)
  }

  const payload = await req.text()
  const valid = await verifyStripeSignature(payload, req.headers.get('stripe-signature'), secret)
  if (!valid) {
    console.error('stripe-webhook: signature invalide ou trop ancienne (secret commence par', secret.slice(0, 6), ', en-tête présent :', !!req.headers.get('stripe-signature'), ')')
    return json({ ok: false, error: 'invalid_signature' }, 400)
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400)
  }

  if (!(SUBSCRIPTION_EVENTS as readonly string[]).includes(event.type)) {
    return json({ ok: true, ignored: event.type })
  }

  try {
    const sub = event.data?.object
    let state = extractSubscriptionState(sub)

    // Abonnement sans métadonnées (créé hors de notre parcours) : on le rattache s'il est
    // déjà connu, sinon il ne nous concerne pas.
    if (!state && sub?.id) {
      const { data: known } = await supabaseAdmin
        .from('subscriptions').select('kind, doctor_id, clinic_id').eq('stripe_subscription_id', sub.id).maybeSingle()
      if (known) {
        state = extractSubscriptionState({
          ...sub, metadata: { kind: known.kind, target_id: (known.kind === 'doctor' ? known.doctor_id : known.clinic_id) as string },
        })
      }
    }
    if (!state) {
      console.error('stripe-webhook: abonnement sans lien avec un praticien/cabinet', sub?.id)
      return json({ ok: true, ignored: 'no_target' })
    }

    const { data, error } = await supabaseAdmin.rpc('apply_subscription_state', {
      p_kind: state.kind,
      p_target_id: state.targetId,
      p_customer_id: state.customerId,
      p_subscription_id: state.subscriptionId,
      p_price_id: state.priceId,
      p_status: state.status,
      p_period_end: state.periodEnd,
      p_cancel_at_period_end: state.cancelAtPeriodEnd,
      p_event_at: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      // Abonnement au prix d'un devis « grand cabinet » : limite de praticiens du devis (sinon null).
      p_max_practitioners: state.maxPractitioners,
    })
    if (error) {
      console.error('stripe-webhook: apply_subscription_state', error)
      return json({ ok: false, error: 'apply_failed' }, 500)
    }

    // Abonnement ouvert depuis un devis : la demande passe en « acceptée » à la première
    // confirmation de paiement. Sans conséquence sur l'activation si cette trace échoue.
    if (state.quoteId && isPaidStatus(state.status)) {
      const { error: quoteErr } = await supabaseAdmin
        .from('quote_requests')
        .update({ status: 'accepted', paid_at: new Date().toISOString() })
        .eq('id', state.quoteId)
        .is('paid_at', null)
      if (quoteErr) console.error('stripe-webhook: mise à jour de la demande de devis', state.quoteId, quoteErr)
    }

    return json({ ok: true, applied: data })
  } catch (e) {
    console.error('stripe-webhook', e)
    return json({ ok: false, error: 'internal' }, 500)
  }
})
