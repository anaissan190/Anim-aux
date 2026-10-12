// supabase/functions/send-report-feedback/index.ts
// Appelée par l'écran admin juste après la clôture d'un signalement (voir
// useAdminResolveReport dans src/hooks/useData.ts). Envoie au praticien qui a
// signalé un avis un email de retour : issue (avis supprimé / conservé / signalement
// non retenu) + le commentaire laissé par l'admin. Demandé par Anaïs le 12/10/2026.
//
// Ne concerne que les signalements d'AVIS (reporter = praticien concerné, imposé
// par create_report, migration 130) ; un signalement de praticien (reporter =
// patient) n'envoie rien : la note admin y reste privée.
//
// Garde-fous : appelant authentifié ET administrateur ; un seul envoi par
// signalement (reports.feedback_sent_at) ; best-effort côté client — la clôture
// du signalement ne dépend jamais de cet email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adminComment, buildFeedbackEmail, feedbackOutcome } from './feedback.ts'

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401)

    const { data: caller } = await supabaseAdmin.from('users').select('is_admin').eq('id', user.id).single()
    if (!caller?.is_admin) return json({ ok: false, error: 'Interdit' }, 403)

    const { reportId } = await req.json()
    if (!reportId) return json({ ok: false, error: 'reportId manquant' }, 400)

    const { data: report, error: reportErr } = await supabaseAdmin
      .from('reports')
      .select('id, reporter_id, target_type, target_id, reason, status, admin_note, target_snapshot, feedback_sent_at')
      .eq('id', reportId)
      .single()
    if (reportErr || !report) return json({ ok: false, error: 'Signalement introuvable' }, 404)

    if (report.target_type !== 'review') return json({ ok: true, skipped: 'not_review' })
    if (report.status === 'pending') return json({ ok: false, error: 'Signalement pas encore traité' }, 400)
    if (report.feedback_sent_at) return json({ ok: true, skipped: 'already_sent' })

    const { data: reporter } = await supabaseAdmin
      .from('users')
      .select('email, profiles!user_id(first_name)')
      .eq('id', report.reporter_id)
      .single()
    const reporterEmail = reporter?.email
    if (!reporterEmail) return json({ ok: true, skipped: 'no_email' })
    const firstName = (reporter?.profiles as any)?.first_name ?? null

    // L'avis a-t-il été supprimé ? Son contenu vient alors de la copie prise au
    // moment du signalement (reports.target_snapshot, migration 131).
    const { data: liveReview } = await supabaseAdmin
      .from('reviews')
      .select('rating, comment')
      .eq('id', report.target_id)
      .maybeSingle()
    const review = liveReview ?? (report.target_snapshot as any) ?? null

    const outcome = feedbackOutcome(report.status as 'resolved' | 'dismissed', !!liveReview)
    const { subject, html } = buildFeedbackEmail({
      firstName, outcome, note: adminComment(report.admin_note), reason: report.reason, review,
    })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('send-report-feedback: RESEND_API_KEY manquant')
      return json({ ok: true, emailSent: false })
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') ?? 'Animéaux <onboarding@resend.dev>',
        to: [reporterEmail],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resendRes.ok) {
      console.error('Resend error', await resendRes.text())
      return json({ ok: true, emailSent: false })
    }

    await supabaseAdmin.from('reports').update({ feedback_sent_at: new Date().toISOString() }).eq('id', report.id)
    return json({ ok: true, emailSent: true })
  } catch (e) {
    console.error(e)
    return json({ ok: false, error: String(e) }, 500)
  }
})
