// supabase/functions/send-doctor-document-notification/index.ts
// Appelée par le client juste après l'envoi d'un document justificatif
// praticien (voir useUploadVerificationDocument dans src/hooks/useData.ts).
// La notification in-app existe déjà (trigger notify_admin_on_verification_
// document, migration 094) — celle-ci ajoute un email à chaque admin, pour
// qu'Anaïs soit prévenue même sans avoir l'app ouverte (demande du
// 22/09/2026).
//
// Best-effort : si l'email échoue (clé Resend absente, domaine pas
// vérifié...), le document reste déposé quand même — voir le try/catch
// côté client, même principe que send-appointment-confirmation.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Vérifie que l'appelant est bien authentifié, et qu'il s'agit du
    // praticien concerné par le document (pas n'importe quel utilisateur
    // connecté) — même garde-fou que send-appointment-confirmation.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { doctorId, documentType, documentLabel } = await req.json()
    if (!doctorId) {
      return new Response('doctorId manquant', { status: 400, headers: corsHeaders })
    }

    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('doctors')
      .select('user_id, profiles!user_id(first_name, last_name)')
      .eq('id', doctorId)
      .single()

    if (doctorError || !doctor) {
      return new Response('Praticien introuvable', { status: 404, headers: corsHeaders })
    }
    if (doctor.user_id !== user.id) {
      return new Response('Interdit', { status: 403, headers: corsHeaders })
    }

    const doctorProfile = doctor.profiles as any
    const doctorName = doctorProfile ? `${doctorProfile.first_name} ${doctorProfile.last_name}` : 'Un praticien'
    const doctorNameHtml = doctorProfile ? `${escapeHtml(doctorProfile.first_name)} ${escapeHtml(doctorProfile.last_name)}` : 'Un praticien'

    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('is_admin', true)

    if (adminsError) console.error('admins select error', adminsError)
    const adminEmails = (admins ?? []).map((a: any) => a.email).filter(Boolean)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    let emailSent = false

    if (resendKey && adminEmails.length > 0) {
      const docTypeHtml = escapeHtml(documentType ?? 'justificatif')
      const docLabelHtml = documentLabel ? ` — ${escapeHtml(documentLabel)}` : ''
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
          </div>
          <h2 style="color: #d9670b;">Document à vérifier</h2>
          <p><strong>${doctorNameHtml}</strong> a déposé un document justificatif :</p>
          <p style="background: #f9fafb; border-radius: 10px; padding: 12px 16px;">📄 ${docTypeHtml}${docLabelHtml}</p>
          <p style="margin-top: 20px;">
            <a href="https://monanimeaux.fr/dashboard/admin" style="background: #d9670b; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 500;">
              Examiner le dossier
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
        </div>
      `
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('EMAIL_FROM') ?? 'Animéaux <onboarding@resend.dev>',
          to: adminEmails,
          subject: `Document à vérifier — ${doctorName}`,
          html,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      emailSent = resendRes.ok
      if (!resendRes.ok) {
        console.error('Resend error', await resendRes.text())
      }
    }

    return new Response(JSON.stringify({ ok: true, emailSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
