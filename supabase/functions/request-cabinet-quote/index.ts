// supabase/functions/request-cabinet-quote/index.ts
// Appelée par le questionnaire « Grand cabinet » (/devis-cabinet, plus de 5 praticiens).
// Enregistre la demande (table quote_requests, migration 135) puis envoie deux emails :
// la demande complète à Anaïs (reply-to = le cabinet) et un accusé de réception au
// praticien. Le devis lui-même est envoyé à la main par Anaïs : le prix se fixe cabinet
// par cabinet.
//
// Garde-fous : appelant authentifié ET praticien ; questionnaire validé côté serveur
// (quote.ts) ; 3 demandes par compte et par 24 h ; la demande est enregistrée AVANT les
// emails, donc un échec d'envoi (journalisé) ne la perd jamais — elle reste visible dans
// l'administration.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  NOTIFY_EMAIL_DEFAULT, buildAdminEmail, buildConfirmationEmail, tooManyRequests, validateQuoteRequest,
} from './quote.ts'

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

async function sendEmail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('request-cabinet-quote: RESEND_API_KEY manquant')
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') ?? 'Animéaux <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('request-cabinet-quote: Resend', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('request-cabinet-quote: envoi de l\'email', e)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) return json({ ok: false, error: 'unauthorized' }, 401)

    const { data: caller, error: callerErr } = await supabaseAdmin
      .from('users').select('role, email').eq('id', user.id).maybeSingle()
    if (callerErr) {
      console.error('request-cabinet-quote: lecture de l\'utilisateur', callerErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    if (caller?.role !== 'doctor') return json({ ok: false, error: 'not_a_doctor' }, 403)
    const requesterEmail = caller.email ?? user.email
    if (!requesterEmail) {
      console.error('request-cabinet-quote: aucune adresse pour', user.id)
      return json({ ok: false, error: 'internal' }, 500)
    }

    const body = await req.json().catch(() => null)
    const validation = validateQuoteRequest(body)
    if (!validation.ok) return json({ ok: false, error: validation.error }, 400)
    const value = validation.value

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles').select('first_name, last_name').eq('user_id', user.id).maybeSingle()
    if (profileErr) console.error('request-cabinet-quote: lecture du profil', profileErr)
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countErr } = await supabaseAdmin
      .from('quote_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    if (countErr) {
      console.error('request-cabinet-quote: comptage des demandes', countErr)
      return json({ ok: false, error: 'internal' }, 500)
    }
    if (tooManyRequests(count ?? 0)) return json({ ok: false, error: 'too_many_requests' }, 429)

    const { data: row, error: insertErr } = await supabaseAdmin
      .from('quote_requests')
      .insert({
        user_id: user.id,
        requester_name: fullName,
        requester_email: requesterEmail,
        clinic_name: value.clinicName,
        city: value.city,
        practitioner_count: value.practitionerCount,
        practitioner_count_next_year: value.practitionerCountNextYear,
        secretary_count: value.secretaryCount,
        phone: value.phone,
        message: value.message,
      })
      .select('id')
      .single()
    if (insertErr || !row) {
      console.error('request-cabinet-quote: enregistrement de la demande', insertErr)
      return json({ ok: false, error: 'internal' }, 500)
    }

    const adminMail = buildAdminEmail({ value, requesterName: fullName, requesterEmail })
    const adminNotified = await sendEmail(
      Deno.env.get('QUOTE_NOTIFY_EMAIL') ?? NOTIFY_EMAIL_DEFAULT, adminMail.subject, adminMail.html, requesterEmail,
    )

    const confirmMail = buildConfirmationEmail({ value, requesterName: profile?.first_name ?? null })
    const confirmationSent = await sendEmail(requesterEmail, confirmMail.subject, confirmMail.html)

    const now = new Date().toISOString()
    const { error: markErr } = await supabaseAdmin
      .from('quote_requests')
      .update({
        admin_notified_at: adminNotified ? now : null,
        confirmation_sent_at: confirmationSent ? now : null,
      })
      .eq('id', row.id)
    if (markErr) console.error('request-cabinet-quote: enregistrement des envois', markErr)

    return json({ ok: true, id: row.id, adminNotified, confirmationSent })
  } catch (e) {
    console.error('request-cabinet-quote', e)
    return json({ ok: false, error: 'internal' }, 500)
  }
})
