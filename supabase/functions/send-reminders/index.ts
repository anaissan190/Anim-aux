// supabase/functions/send-reminders/index.ts
// Cette Edge Function est appelée par un cron Supabase toutes les heures
// Elle envoie des rappels pour les RDV dans les 24h

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

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
      patient:users!patient_id(email, profiles(first_name, last_name)),
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

    sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
