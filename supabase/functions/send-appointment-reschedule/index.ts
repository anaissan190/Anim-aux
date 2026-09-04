// supabase/functions/send-appointment-reschedule/index.ts
// Appelée par le trigger notify_email_sms_on_appointment_rescheduled
// (migration 077) à chaque notification de type 'appointment_rescheduled' —
// un praticien vient de reporter un RDV confirmé à un nouveau créneau
// (notification in-app déjà gérée par la migration 077, premier trigger).
// Complément email (Resend) + SMS (OVH), même mécanisme que
// send-appointment-cancellation. Best-effort : ne doit jamais faire
// échouer la notification elle-même (déjà garanti côté trigger, en
// fire-and-forget via pg_net).

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Normalise un numéro français saisi sous n'importe quelle forme courante
// vers le format E.164 attendu par l'API SMS OVH — même logique que
// send-reminders/index.ts et send-appointment-confirmation/index.ts.
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
  // N'accepte que l'appel du trigger SQL (migration 077), qui envoie déjà
  // Authorization: Bearer <service_role_key>. Sans cette vérification,
  // n'importe qui muni de la clé anon publique pouvait appeler cette
  // fonction pour un notification_id qu'il peut lire, et déclencher
  // email/SMS à volonté.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey || req.headers.get('Authorization') !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let notificationId: string | undefined
  try {
    ({ notification_id: notificationId } = await req.json())
  } catch {
    return new Response('Corps JSON invalide', { status: 400 })
  }
  if (!notificationId) return new Response('notification_id manquant', { status: 400 })

  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .select('related_id')
    .eq('id', notificationId)
    .single()
  if (notifError || !notification?.related_id) {
    return new Response('Notification introuvable', { status: 404 })
  }

  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .select(`
      id, start_at,
      patient:users!patient_id(email, profiles(first_name, phone)),
      doctors!inner(profiles!inner(first_name, last_name))
    `)
    .eq('id', notification.related_id)
    .single()
  if (apptError || !appt) {
    return new Response('RDV introuvable', { status: 404 })
  }

  const patientProfile = (appt.patient as any)?.profiles
  const patientEmail = (appt.patient as any)?.email
  const doctorProfile = (appt.doctors as any)?.profiles
  const doctorName = doctorProfile ? `Dr ${doctorProfile.first_name} ${doctorProfile.last_name}` : 'Votre praticien'

  const dateStr = new Date(appt.start_at).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  let emailSent = false

  if (resendKey && patientEmail) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
        </div>
        <h2 style="color: #d9670b;">Rendez-vous reporté</h2>
        <p>Bonjour ${patientProfile?.first_name ?? ''},</p>
        <p>${doctorName} a reporté votre rendez-vous. Nouvelle date :</p>
        <p style="font-size: 16px; font-weight: 600; margin: 16px 0;">${dateStr}</p>
        <p style="margin-top: 20px;">
          <a href="https://monanimeaux.fr/rendez-vous" style="background: #d9670b; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 500;">
            Voir mes rendez-vous
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
        to: patientEmail,
        subject: 'Votre rendez-vous a été reporté',
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
      `Animeaux : votre RDV avec ${doctorName} a ete reporte au ${shortDate}.`,
      patientPhone
    )
  }

  return new Response(JSON.stringify({ ok: true, emailSent, smsSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
