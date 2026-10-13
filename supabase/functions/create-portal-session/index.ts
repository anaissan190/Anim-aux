// supabase/functions/create-portal-session/index.ts
// Ouvre le portail client Stripe (changer de carte, voir les factures, résilier) pour
// la personne connectée. Appelée par le navigateur avec le JWT de l'utilisateur ; ne
// renvoie que l'adresse du portail de SON propre client Stripe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.error('create-portal-session: STRIPE_SECRET_KEY manquant')
      return json({ ok: false, error: 'billing_not_configured' }, 503)
    }

    const { data: customer, error: custErr } = await supabaseAdmin
      .from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
    if (custErr) {
      console.error('create-portal-session: lecture du client', custErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    if (!customer) return json({ ok: false, error: 'no_customer' }, 404)

    const appUrl = Deno.env.get('APP_URL') || 'https://monanimeaux.fr'
    const params = new URLSearchParams({
      customer: customer.stripe_customer_id,
      return_url: `${appUrl}/abonnement`,
    })
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(15_000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.url) {
      console.error('create-portal-session: Stripe', res.status, JSON.stringify(body).slice(0, 500))
      return json({ ok: false, error: 'stripe_error' }, 502)
    }
    return json({ ok: true, url: body.url })
  } catch (e) {
    console.error('create-portal-session', e)
    return json({ ok: false, error: 'internal' }, 500)
  }
})
