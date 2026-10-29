// supabase/functions/delete-my-account/index.ts
// Supprime le compte d'un praticien qui a un abonnement en cours, depuis n'importe quel écran
// (dont l'application native, où aucun lien vers la résiliation ne peut être proposé).
// Ordre voulu, du plus réversible au plus définitif :
//   1. programmer la fin de chaque abonnement chez Stripe (plus aucun prélèvement, la période
//      déjà payée n'est pas remboursée) ;
//   2. recopier cette programmation dans la base ;
//   3. appeler delete_my_account AVEC LE JETON DE LA PERSONNE (auth.uid() = elle) : c'est la même
//      fonction que d'habitude, qui garde ses propres contrôles.
// Si l'étape 1 échoue, rien n'est supprimé. Si l'étape 3 échoue, l'abonnement reste programmé pour
// finir et la personne peut réessayer (la suppression ne sera alors plus bloquée).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkStripeSecret, subscriptionsToCancel } from '../_shared/billing.ts'
import { stripePost } from '../_shared/billingDb.ts'

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

    // Abonnements du praticien et des cabinets dont il est le créateur.
    const { data: doctor } = await supabaseAdmin.from('doctors').select('id').eq('user_id', user.id).maybeSingle()
    const { data: clinics, error: clinicsErr } = await supabaseAdmin.from('clinics').select('id').eq('owner_id', user.id)
    if (clinicsErr) {
      console.error('delete-my-account: lecture des cabinets', clinicsErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    const filters = [
      ...(doctor ? [`doctor_id.eq.${doctor.id}`] : []),
      ...(clinics ?? []).map((c: { id: string }) => `clinic_id.eq.${c.id}`),
    ]
    let toCancel: string[] = []
    if (filters.length > 0) {
      const { data: rows, error: subsErr } = await supabaseAdmin
        .from('subscriptions').select('stripe_subscription_id, status, cancel_at_period_end').or(filters.join(','))
      if (subsErr) {
        console.error('delete-my-account: lecture des abonnements', subsErr)
        return json({ ok: false, error: 'internal' }, 500)
      }
      toCancel = subscriptionsToCancel(rows)
    }

    if (toCancel.length > 0) {
      const key = checkStripeSecret({ STRIPE_SECRET_KEY: Deno.env.get('STRIPE_SECRET_KEY') })
      if (!key.ok) {
        console.error('delete-my-account: Stripe mal configuré, aucun compte supprimé :', key.problem)
        return json({ ok: false, error: key.code }, 503)
      }
      for (const subId of toCancel) {
        const res = await stripePost(key.secretKey, `subscriptions/${subId}`, new URLSearchParams({ cancel_at_period_end: 'true' }))
        if (!res.ok) {
          console.error('delete-my-account: Stripe', subId, res.status, JSON.stringify(res.body).slice(0, 500))
          return json({ ok: false, error: 'stripe_error' }, 502)
        }
        const { error: updErr } = await supabaseAdmin
          .from('subscriptions').update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId)
        if (updErr) {
          console.error('delete-my-account: mise à jour de la ligne', subId, updErr)
          return json({ ok: false, error: 'internal' }, 500)
        }
      }
    }

    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { error: delErr } = await asUser.rpc('delete_my_account')
    if (delErr) {
      console.error('delete-my-account: delete_my_account', delErr)
      return json({ ok: false, error: 'delete_failed', message: delErr.message ?? null }, 409)
    }
    return json({ ok: true, cancelled: toCancel.length })
  } catch (e) {
    console.error('delete-my-account', e)
    return json({ ok: false, error: 'internal' }, 500)
  }
})
