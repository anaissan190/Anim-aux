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
import { buildCheckoutParams, checkBillingConfig, isPaidStatus, kindForPlan, type PaidPlan } from '../_shared/billing.ts'

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

async function stripePost(key: string, path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

// Même alphabet que le code d'invitation créé côté application (useCreateClinic).
function inviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) return json({ ok: false, error: 'unauthorized' }, 401)

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
      const { data: clinic } = await supabaseAdmin
        .from('clinics').select('id, plan').eq('owner_id', user.id).limit(1).maybeSingle()
      if (clinic) {
        if (clinic.plan === 'cabinet') return json({ ok: false, error: 'already_subscribed' }, 409)
        targetId = clinic.id
      } else {
        const name = typeof clinicName === 'string' ? clinicName.trim() : ''
        if (!name) return json({ ok: false, error: 'clinic_name_required' }, 400)
        const { data: created, error: createErr } = await supabaseAdmin
          .from('clinics')
          .insert({ name, city: typeof clinicCity === 'string' ? clinicCity.trim() || null : null, owner_id: user.id, invite_code: inviteCode() })
          .select('id').single()
        if (createErr || !created) {
          console.error('create-checkout-session: création du cabinet', createErr)
          return json({ ok: false, error: 'internal' }, 500)
        }
        const { error: memberErr } = await supabaseAdmin
          .from('clinic_members').insert({ clinic_id: created.id, doctor_id: doctor.id })
        if (memberErr) {
          console.error('create-checkout-session: ajout du créateur au cabinet', memberErr)
          return json({ ok: false, error: 'internal' }, 500)
        }
        targetId = created.id
      }
    }

    // Déjà abonné (même par une autre voie) : on ne crée pas un second abonnement.
    const { data: existing } = await supabaseAdmin
      .from('subscriptions').select('status, cancel_at_period_end')
      .eq(kind === 'doctor' ? 'doctor_id' : 'clinic_id', targetId)
    if ((existing ?? []).some((s: any) => isPaidStatus(s.status) && !s.cancel_at_period_end)) {
      return json({ ok: false, error: 'already_subscribed' }, 409)
    }
    if (kind === 'doctor' && doctor.plan === 'pro' && (existing ?? []).length === 0) {
      // Offre « fondateur » attribuée par l'administration : rien à payer pour l'instant.
      return json({ ok: false, error: 'already_subscribed' }, 409)
    }

    // Client Stripe : un par compte, réutilisé aux paiements suivants.
    let customerId: string
    const { data: known } = await supabaseAdmin
      .from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
    if (known) {
      customerId = known.stripe_customer_id
    } else {
      const created = await stripePost(stripeKey, 'customers', new URLSearchParams({
        ...(user.email ? { email: user.email } : {}),
        'metadata[user_id]': user.id,
      }))
      if (!created.ok || !created.body.id) {
        console.error('create-checkout-session: création du client Stripe', created.status, JSON.stringify(created.body).slice(0, 500))
        return json({ ok: false, error: 'stripe_error' }, 502)
      }
      customerId = created.body.id
      const { error: saveErr } = await supabaseAdmin
        .from('billing_customers').insert({ user_id: user.id, stripe_customer_id: customerId })
      if (saveErr) console.error('create-checkout-session: enregistrement du client', saveErr)
    }

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
