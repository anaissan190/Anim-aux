// supabase/functions/send-appointment-confirmation/index.ts
// Appelée par le client juste après la création d'un RDV (voir
// useCreateAppointment dans src/hooks/useData.ts). Envoie un email de
// confirmation au patient via Resend, un SMS via l'API OVH (mêmes secrets
// que send-reminders, partagés au niveau du projet), et crée en parallèle
// la notification in-app correspondante (type 'appointment_confirmed',
// déjà dans le schéma mais jamais utilisée jusqu'ici — voir 001_schema.sql).
//
// Best-effort : si l'email ou le SMS échoue (clé absente, domaine pas
// vérifié...), le RDV reste confirmé quand même — voir le try/catch côté
// client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// appt.reason est un texte libre saisi par le patient à la réservation,
// interpolé tel quel dans l'email de confirmation — sans échappement, un
// motif contenant du HTML/JS s'exécutait dans l'email officiel du patient
// (auto-ciblé puisqu'envoyé à sa propre adresse, mais un vecteur réel si le
// motif est copié/transféré ou affiché ailleurs).
function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Appelée depuis le navigateur (useCreateAppointment) : le preflight CORS
// (OPTIONS) doit recevoir une réponse explicite avec ces headers, sinon le
// fetch échoue avant même d'atteindre la logique ci-dessous — même
// principe que invite-clinic-secretary/index.ts. Sans ça, le RDV reste
// bien créé (l'appel est côté client, en best-effort) mais aucun
// email/SMS/notification n'est jamais envoyé, silencieusement.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalise un numéro français saisi sous n'importe quelle forme courante
// vers le format E.164 attendu par l'API SMS OVH — même logique que
// send-reminders/index.ts.
function toE164(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null
  const digits = rawPhone.replace(/[\s.\-()]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`
  if (digits.startsWith('33') && digits.length === 11) return `+${digits}`
  return null
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sendOvhSms(message: string, receiver: string) {
  const appKey = Deno.env.get('OVH_APP_KEY')
  const appSecret = Deno.env.get('OVH_APP_SECRET')
  const consumerKey = Deno.env.get('OVH_CONSUMER_KEY')
  const serviceName = Deno.env.get('OVH_SMS_SERVICE_NAME')
  if (!appKey || !appSecret || !consumerKey || !serviceName) return false

  const url = `https://eu.api.ovh.com/1.0/sms/${serviceName}/jobs`
  const body = JSON.stringify({ message, receivers: [receiver] })

  const timeRes = await fetch('https://eu.api.ovh.com/1.0/auth/time')
  const timestamp = await timeRes.text()

  const signature = '$1$' + await sha1Hex(`${appSecret}+${consumerKey}+POST+${url}+${body}+${timestamp}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ovh-Application': appKey,
      'X-Ovh-Consumer': consumerKey,
      'X-Ovh-Timestamp': timestamp,
      'X-Ovh-Signature': signature,
    },
    body,
  })
  if (!res.ok) {
    console.error('OVH SMS error', await res.text())
  }
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Vérifie que l'appelant est bien authentifié, et qu'il s'agit du
    // patient concerné par le RDV (pas n'importe quel utilisateur connecté).
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { appointmentId } = await req.json()
    if (!appointmentId) {
      return new Response('appointmentId manquant', { status: 400, headers: corsHeaders })
    }

    const { data: appt, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, start_at, reason, patient_id,
        patient:users!patient_id(email, profiles(first_name, last_name, phone)),
        doctors!inner(consultation_price, specialty, profiles!inner(first_name, last_name))
      `)
      .eq('id', appointmentId)
      .single()

    if (error || !appt) {
      return new Response('RDV introuvable', { status: 404, headers: corsHeaders })
    }
    if (appt.patient_id !== user.id) {
      return new Response('Interdit', { status: 403, headers: corsHeaders })
    }

    const patientProfile = (appt.patient as any)?.profiles
    const patientEmail = (appt.patient as any)?.email
    const doctorProfile = (appt.doctors as any)?.profiles
    const doctorSpecialty = (appt.doctors as any)?.specialty
    const doctorName = doctorProfile ? `Dr ${doctorProfile.first_name} ${doctorProfile.last_name}` : 'votre praticien'
    const price = (appt.doctors as any)?.consultation_price

    const dateStr = new Date(appt.start_at).toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Europe/Paris',
    })

    // Notification in-app — même logique que send-reminders.
    await supabaseAdmin.from('notifications').insert({
      user_id: appt.patient_id,
      type: 'appointment_confirmed',
      title: 'Rendez-vous confirmé',
      body: `Votre RDV avec ${doctorName} est confirmé pour le ${dateStr}.`,
      related_id: appt.id,
    })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    let emailSent = false

    if (resendKey && patientEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
          </div>
          <h2 style="color: #d9670b;">Rendez-vous confirmé 🐾</h2>
          <p>Bonjour ${patientProfile?.first_name ?? ''},</p>
          <p>Votre rendez-vous vient d'être confirmé :</p>
          <ul style="line-height: 1.8;">
            <li><strong>Avec :</strong> ${doctorName}${doctorSpecialty ? ` (${doctorSpecialty})` : ''}</li>
            <li><strong>Le :</strong> ${dateStr}</li>
            ${appt.reason ? `<li><strong>Motif :</strong> ${escapeHtml(appt.reason)}</li>` : ''}
            ${price ? `<li><strong>Tarif :</strong> ${price} €</li>` : ''}
          </ul>
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
          to: patientEmail,
          subject: 'Votre rendez-vous est confirmé',
          html,
        }),
      })
      emailSent = resendRes.ok
      if (!resendRes.ok) {
        console.error('Resend error', await resendRes.text())
      }
    }

    let smsSent = false
    const patientPhone = toE164(patientProfile?.phone)
    if (patientPhone) {
      const shortDate = new Date(appt.start_at).toLocaleString('fr-FR', {
        dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris',
      })
      smsSent = await sendOvhSms(
        `Animeaux : votre RDV avec ${doctorName} le ${shortDate} est confirme.`,
        patientPhone
      )
    }

    return new Response(JSON.stringify({ ok: true, emailSent, smsSent }), {
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
