// supabase/functions/create-checkout-session/index.ts
// Démarre un paiement d'abonnement : renvoie l'adresse de la page de paiement Stripe
// (Checkout). Appelée par le navigateur avec le JWT du praticien.
//
// Règles (imposées ici, jamais seulement par l'écran) :
//   * seul un praticien dont le dossier est VÉRIFIÉ peut s'abonner (on ne fait pas
//     payer quelqu'un dont les documents peuvent encore être refusés) ;
//   * « pro » = abonnement individuel (rattaché au praticien) ;
//   * « cabinet » = abonnement du cabinet, payé par son créateur. S'il n'a pas encore de
//     cabinet, il est créé ici (nom obligatoire), non activé jusqu'à confirmation du
//     paiement par le webhook ;
//   * on ne propose pas de se réabonner à qui l'est déjà.
// L'offre n'est JAMAIS activée ici : seule la confirmation signée de Stripe (webhook) le fait.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCheckoutParams, checkBillingConfig, kindForPlan, type PaidPlan } from '../_shared/billing.ts'
import { ensureOwnedClinic, ensureStripeCustomer, hasPaidSubscription, isPrelaunch, stripePost } from '../_shared/billingDb.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) return json({ ok: false, error: 'unauthorized' }, 401)

    if (await isPrelaunch(supabaseAdmin)) return json({ ok: false, error: 'prelaunch' }, 403)

    const { plan, clinicName, clinicCity } = await req.json()
    if (plan !== 'pro' && plan !== 'cabinet') return json({ ok: false, error: 'invalid_plan' }, 400)
    const paidPlan = plan as PaidPlan

    const config = checkBillingConfig(paidPlan, Deno.env.toObject())
    if (!config.ok) {
      console.error('create-checkout-session: configuration Stripe —', config.problem)
      return json({ ok: false, error: config.code }, 503)
    }
    const stripeKey = config.secretKey
    const priceId = config.priceId

    const { data: doctor, error: doctorErr } = await supabaseAdmin
      .from('doctors').select('id, plan, verification_status').eq('user_id', user.id).maybeSingle()
    if (doctorErr) {
      console.error('create-checkout-session: lecture du praticien', doctorErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    if (!doctor) return json({ ok: false, error: 'not_a_doctor' }, 403)
    if (doctor.verification_status !== 'verified') return json({ ok: false, error: 'not_verified' }, 403)

    // Cible de l'abonnement : le praticien, ou son cabinet.
    const kind = kindForPlan(paidPlan)
    let targetId = doctor.id as string

    if (paidPlan === 'cabinet') {
      const owned = await ensureOwnedClinic(supabaseAdmin, {
        userId: user.id, doctorId: doctor.id, log: 'create-checkout-session',
        name: typeof clinicName === 'string' ? clinicName : '',
        city: typeof clinicCity === 'string' ? clinicCity : null,
      })
      if (!owned.ok) return json({ ok: false, error: owned.code }, owned.code === 'clinic_name_required' ? 400 : 500)
      if (!owned.created && owned.plan === 'cabinet') return json({ ok: false, error: 'already_subscribed' }, 409)
      targetId = owned.clinicId
    }

    // Déjà abonné (même par une autre voie) : on ne crée pas un second abonnement.
    if (await hasPaidSubscription(supabaseAdmin, kind, targetId)) {
      return json({ ok: false, error: 'already_subscribed' }, 409)
    }
    if (kind === 'doctor' && doctor.plan === 'pro') {
      const { count } = await supabaseAdmin
        .from('subscriptions').select('id', { count: 'exact', head: true }).eq('doctor_id', targetId)
      if ((count ?? 0) === 0) {
        // Offre « fondateur » attribuée par l'administration : rien à payer pour l'instant.
        return json({ ok: false, error: 'already_subscribed' }, 409)
      }
    }

    // Client Stripe : un par compte, réutilisé aux paiements suivants.
    const customer = await ensureStripeCustomer(supabaseAdmin, stripeKey, {
      userId: user.id, email: user.email, log: 'create-checkout-session',
    })
    if (!customer.ok) return json({ ok: false, error: 'stripe_error' }, 502)
    const customerId = customer.customerId

    const appUrl = Deno.env.get('APP_URL') || 'https://monanimeaux.fr'
    const params = buildCheckoutParams({
      customerId, priceId, kind, targetId, userId: user.id,
      successUrl: `${appUrl}/abonnement?paiement=succes`,
      cancelUrl: `${appUrl}/abonnement?paiement=annule`,
      automaticTax: Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true',
    })
    const session = await stripePost(stripeKey, 'checkout/sessions', params)
    if (!session.ok || !session.body.url) {
      console.error('create-checkout-session: session Stripe', session.status, JSON.stringify(session.body).slice(0, 500))
      return json({ ok: false, error: 'stripe_error' }, 502)
    }
    return json({ ok: true, url: session.body.url })
  } catch (e) {
    console.error('create-checkout-session', e)
    return json({ ok: false, error: 'internal' }, 500)
  }
})
