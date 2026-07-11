// supabase/functions/send-appointment-confirmation/index.ts
// Appelée par le client juste après la création d'un RDV (voir
// useCreateAppointment dans src/hooks/useData.ts). Envoie un email de
// confirmation au patient via Resend, et crée en parallèle la notification
// in-app correspondante (type 'appointment_confirmed', déjà dans le schéma
// mais jamais utilisée jusqu'ici — voir 001_schema.sql).
//
// Best-effort : si l'email échoue (clé Resend absente/domaine non vérifié),
// le RDV reste confirmé quand même — voir le try/catch côté client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    // Vérifie que l'appelant est bien authentifié, et qu'il s'agit du
    // patient concerné par le RDV (pas n'importe quel utilisateur connecté).
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { appointmentId } = await req.json()
    if (!appointmentId) {
      return new Response('appointmentId manquant', { status: 400 })
    }

    const { data: appt, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, start_at, reason, patient_id,
        patient:users!patient_id(email, profiles(first_name, last_name)),
        doctors!inner(consultation_price, profiles!inner(first_name, last_name, specialty))
      `)
      .eq('id', appointmentId)
      .single()

    if (error || !appt) {
      return new Response('RDV introuvable', { status: 404 })
    }
    if (appt.patient_id !== user.id) {
      return new Response('Interdit', { status: 403 })
    }

    const patientProfile = (appt.patient as any)?.profiles
    const patientEmail = (appt.patient as any)?.email
    const doctorProfile = (appt.doctors as any)?.profiles
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
          <h2 style="color: #d9670b;">Rendez-vous confirmé 🐾</h2>
          <p>Bonjour ${patientProfile?.first_name ?? ''},</p>
          <p>Votre rendez-vous vient d'être confirmé :</p>
          <ul style="line-height: 1.8;">
            <li><strong>Avec :</strong> ${doctorName}${doctorProfile?.specialty ? ` (${doctorProfile.specialty})` : ''}</li>
            <li><strong>Le :</strong> ${dateStr}</li>
            ${appt.reason ? `<li><strong>Motif :</strong> ${appt.reason}</li>` : ''}
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

    return new Response(JSON.stringify({ ok: true, emailSent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
