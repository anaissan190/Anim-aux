// supabase/functions/create-quote-checkout/index.ts
// Ouvre la page de paiement Stripe d'un devis « grand cabinet » (plus de 5 praticiens).
// Appelée par la page /paiement-devis/<jeton> avec le JWT du praticien qui a fait la demande.
//
// Le lien que l'admin joint à son devis ne porte que le jeton ; la session Stripe est créée
// ICI, au moment du clic (une session Stripe expire en 24 h au plus, pas le lien). Règles,
// imposées ici et pas seulement par l'écran :
//   * le jeton doit avoir la bonne forme et correspondre à une demande ;
//   * seule la personne qui a fait la demande peut payer, une seule fois, et seulement si
//     l'admin a bien fixé un prix et une limite de praticiens (checkQuoteLink) ;
//   * le praticien doit être VÉRIFIÉ, comme pour l'abonnement normal ;
//   * son cabinet est créé ici s'il n'existe pas encore (nom de la demande), non activé ;
//   * pas de second abonnement pour un cabinet déjà abonné.
// L'offre n'est JAMAIS activée ici : seule la confirmation signée de Stripe (webhook) le fait,
// avec la limite de praticiens du devis portée par les métadonnées de l'abonnement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildQuoteCheckoutParams, checkQuoteLink, checkStripeSecret, isQuoteToken } from '../_shared/billing.ts'
import { ensureOwnedClinic, ensureStripeCustomer, hasPaidSubscription, stripePost } from '../_shared/billingDb.ts'

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

const LOG = 'create-quote-checkout'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) return json({ ok: false, error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => null)
    const token = body?.token
    if (!isQuoteToken(token)) return json({ ok: false, error: 'quote_not_found' }, 404)

    const stripe = checkStripeSecret(Deno.env.toObject())
    if (!stripe.ok) {
      console.error(`${LOG}: configuration Stripe —`, stripe.problem)
      return json({ ok: false, error: stripe.code }, 503)
    }

    const { data: quote, error: quoteErr } = await supabaseAdmin
      .from('quote_requests')
      .select('id, user_id, clinic_name, city, offer_price_cents, offer_max_practitioners, paid_at')
      .eq('payment_token', token)
      .maybeSingle()
    if (quoteErr) {
      console.error(`${LOG}: lecture de la demande`, quoteErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    const link = checkQuoteLink(quote, user.id)
    if (!link.ok) {
      return json({ ok: false, error: link.code }, link.code === 'quote_not_found' ? 404 : link.code === 'already_paid' ? 409 : 403)
    }

    const { data: doctor, error: doctorErr } = await supabaseAdmin
      .from('doctors').select('id, verification_status').eq('user_id', user.id).maybeSingle()
    if (doctorErr) {
      console.error(`${LOG}: lecture du praticien`, doctorErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    if (!doctor) return json({ ok: false, error: 'not_a_doctor' }, 403)
    if (doctor.verification_status !== 'verified') return json({ ok: false, error: 'not_verified' }, 403)

    const owned = await ensureOwnedClinic(supabaseAdmin, {
      userId: user.id, doctorId: doctor.id, log: LOG, name: quote!.clinic_name, city: quote!.city,
    })
    if (!owned.ok) return json({ ok: false, error: owned.code === 'clinic_name_required' ? 'internal' : owned.code }, 500)
    const clinicId = owned.clinicId

    if (await hasPaidSubscription(supabaseAdmin, 'clinic', clinicId)) {
      return json({ ok: false, error: 'already_subscribed' }, 409)
    }

    const customer = await ensureStripeCustomer(supabaseAdmin, stripe.secretKey, {
      userId: user.id, email: user.email, log: LOG,
    })
    if (!customer.ok) return json({ ok: false, error: 'stripe_error' }, 502)

    const appUrl = Deno.env.get('APP_URL') || 'https://monanimeaux.fr'
    const params = buildQuoteCheckoutParams({
      customerId: customer.customerId,
      priceCents: link.priceCents,
      maxPractitioners: link.maxPractitioners,
      clinicId,
      userId: user.id,
      quoteId: quote!.id,
      successUrl: `${appUrl}/abonnement?paiement=succes`,
      cancelUrl: `${appUrl}/paiement-devis/${token}?paiement=annule`,
      automaticTax: Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true',
    })
    const session = await stripePost(stripe.secretKey, 'checkout/sessions', params)
    if (!session.ok || !session.body.url) {
      console.error(`${LOG}: session Stripe`, session.status, JSON.stringify(session.body).slice(0, 500))
      return json({ ok: false, error: 'stripe_error' }, 502)
    }

    // Trace pour l'admin : quel cabinet, et quand le paiement a été ouvert. Sans conséquence si ça échoue.
    const { error: markErr } = await supabaseAdmin
      .from('quote_requests')
      .update({ offer_clinic_id: clinicId, checkout_started_at: new Date().toISOString() })
      .eq('id', quote!.id)
    if (markErr) console.error(`${LOG}: enregistrement de l'ouverture du paiement`, markErr)

    return json({ ok: true, url: session.body.url })
  } catch (e) {
    console.error(LOG, e)
    return json({ ok: false, error: 'internal' }, 500)
  }
})
