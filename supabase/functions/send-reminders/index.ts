// supabase/functions/send-reminders/index.ts
// Cette Edge Function est appelée par un cron Supabase toutes les heures
// Elle envoie des rappels pour les RDV dans les 24h

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Normalise un numéro français saisi sous n'importe quelle forme courante
// (espaces, points, tirets, avec ou sans indicatif) vers le format E.164
// attendu par l'API SMS OVH. Retourne null si le résultat ne ressemble pas
// à un numéro exploitable, plutôt que d'envoyer un SMS voué à échouer.
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

// Envoi via l'API SMS OVH (compte "Standard") : authentification propre
// à OVH (signature = sha1 de
// AppSecret+ConsumerKey+méthode+url+corps+timestamp), distincte du simple
// Bearer token utilisé pour Resend. Best-effort : une erreur ici ne doit
// jamais empêcher l'email/la notification in-app déjà envoyés.
async function sendOvhSms(message: string, receiver: string) {
  const appKey = Deno.env.get('OVH_APP_KEY')
  const appSecret = Deno.env.get('OVH_APP_SECRET')
  const consumerKey = Deno.env.get('OVH_CONSUMER_KEY')
  const serviceName = Deno.env.get('OVH_SMS_SERVICE_NAME')
  if (!appKey || !appSecret || !consumerKey || !serviceName) return

  const url = `https://eu.api.ovh.com/1.0/sms/${serviceName}/jobs`
  const body = JSON.stringify({ message, receivers: [receiver] })

  // Horloge officielle OVH plutôt que celle du runtime Edge Function : la
  // signature est rejetée si le timestamp dévie de plus de quelques
  // secondes de leur serveur.
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
}

Deno.serve(async (req) => {
  // Sécurité : vérifie la clé secrète (à ajouter dans les env Supabase)
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // RDV dans les prochaines 24-25h (la fonction tourne toutes les heures)
  const from = new Date()
  from.setHours(from.getHours() + 24)
  const to = new Date(from)
  to.setHours(to.getHours() + 1)

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, start_at, reason, patient_id,
      patient:users!patient_id(email, profiles(first_name, last_name, phone)),
      doctors!inner(profiles!inner(first_name, last_name, specialty))
    `)
    .gte('start_at', from.toISOString())
    .lt('start_at', to.toISOString())
    .eq('status', 'confirmed')

  const resendKey = Deno.env.get('RESEND_API_KEY')

  let sent = 0
  for (const appt of appointments ?? []) {
    const patientProfile = (appt.patient as any)?.profiles
    const patientEmail = (appt.patient as any)?.email
    const doctorProfile = (appt.doctors as any)?.profiles
    const doctorName = doctorProfile ? `Dr ${doctorProfile.first_name} ${doctorProfile.last_name}` : 'votre praticien'

    const dateStr = new Date(appt.start_at).toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Europe/Paris',
    })

    // Crée la notification in-app — user_id = patient_id (appointments.patient_id
    // référence directement users.id, pas besoin de passer par profiles).
    await supabase.from('notifications').insert({
      user_id: appt.patient_id,
      type: 'appointment_reminder',
      title: 'Rappel de rendez-vous',
      body: `Votre RDV avec ${doctorName} est demain.`,
      related_id: appt.id,
    })

    if (resendKey && patientEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #d9670b;">Rappel de rendez-vous 🐾</h2>
          <p>Bonjour ${patientProfile?.first_name ?? ''},</p>
          <p>Petit rappel : vous avez un rendez-vous demain.</p>
          <ul style="line-height: 1.8;">
            <li><strong>Avec :</strong> ${doctorName}${doctorProfile?.specialty ? ` (${doctorProfile.specialty})` : ''}</li>
            <li><strong>Le :</strong> ${dateStr}</li>
            ${appt.reason ? `<li><strong>Motif :</strong> ${appt.reason}</li>` : ''}
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
          subject: 'Rappel de votre rendez-vous demain',
          html,
        }),
      })
      if (!resendRes.ok) {
        console.error('Resend error', await resendRes.text())
      }
    }

    const patientPhone = toE164(patientProfile?.phone)
    if (patientPhone) {
      const shortDate = new Date(appt.start_at).toLocaleString('fr-FR', {
        dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris',
      })
      await sendOvhSms(
        `Animeaux : rappel RDV avec ${doctorName} le ${shortDate}.`,
        patientPhone
      )
    }

    sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
