// supabase/functions/send-reminders/index.ts
// Cette Edge Function est appelée par un cron Supabase toutes les heures.
// Elle envoie des rappels pour les RDV dans les 24h, des rappels de
// vaccin (vaccines.next_due_date, saisi par le praticien) dans les 7
// jours, et une invitation à laisser un avis quelques heures après un
// RDV marqué terminé par le praticien.

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

async function sendReminderEmail(resendKey: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'Animéaux <onboarding@resend.dev>',
      to, subject, html,
    }),
  })
  if (!res.ok) {
    console.error('Resend error', await res.text())
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
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
          </div>
          <h2 style="color: #d9670b;">Rappel de rendez-vous 🐾</h2>
          <p>Bonjour ${patientProfile?.first_name ?? ''},</p>
          <p>Petit rappel : vous avez un rendez-vous demain.</p>
          <ul style="line-height: 1.8;">
            <li><strong>Avec :</strong> ${doctorName}${doctorProfile?.specialty ? ` (${doctorProfile.specialty})` : ''}</li>
            <li><strong>Le :</strong> ${dateStr}</li>
            ${appt.reason ? `<li><strong>Motif :</strong> ${appt.reason}</li>` : ''}
          </ul>
          <p style="margin-top: 20px;">
            <a href="https://monanimeaux.fr/confirmer-presence/${appt.id}" style="background: #d9670b; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 500;">
              ✓ Je confirme ma présence
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
        </div>
      `
      await sendReminderEmail(resendKey, patientEmail, 'Rappel de votre rendez-vous demain', html)
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

  // Rappels de vaccin : la date de rappel (next_due_date) est saisie une
  // fois par le praticien sur la fiche santé de l'animal, potentiellement
  // des mois à l'avance — on avertit le propriétaire dans la semaine qui
  // précède l'échéance, une seule fois (reminder_sent_at empêche de le
  // renvoyer à chaque exécution horaire tant que la date reste dans cette
  // fenêtre de 7 jours).
  const weekAhead = new Date()
  weekAhead.setDate(weekAhead.getDate() + 7)

  // next_due_date est une simple DATE (sans heure) saisie par le praticien
  // en pensant en heure française — toISOString().slice(0,10) prend la date
  // UTC, décalée d'un jour par rapport à Paris entre ~22h et minuit UTC (le
  // reste du fichier utilise explicitement Europe/Paris pour l'affichage,
  // mais ces deux bornes ne le faisaient pas).
  const parisDateStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

  const { data: dueVaccines } = await supabase
    .from('vaccines')
    .select(`
      id, name, next_due_date, animal_id,
      animals!inner(name, owner:users!owner_id(email, profiles(first_name, last_name, phone)))
    `)
    .not('next_due_date', 'is', null)
    .is('reminder_sent_at', null)
    .lte('next_due_date', parisDateStr(weekAhead))
    .gte('next_due_date', parisDateStr(new Date()))

  let vaccineReminders = 0
  for (const vaccine of dueVaccines ?? []) {
    const animal = (vaccine.animals as any)
    const owner = animal?.owner
    const ownerProfile = owner?.profiles
    const ownerEmail = owner?.email
    const dueDateStr = new Date(vaccine.next_due_date).toLocaleDateString('fr-FR', {
      dateStyle: 'long', timeZone: 'Europe/Paris',
    })

    await supabase.from('notifications').insert({
      user_id: animal?.owner_id ?? null,
      type: 'vaccine_reminder',
      title: 'Rappel de vaccin',
      body: `${animal?.name ?? 'Votre animal'} doit recevoir un rappel de vaccin (${vaccine.name}) avant le ${dueDateStr}.`,
      related_id: vaccine.animal_id,
    })

    if (resendKey && ownerEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
          </div>
          <h2 style="color: #d9670b;">Rappel de vaccin 🐾</h2>
          <p>Bonjour ${ownerProfile?.first_name ?? ''},</p>
          <p>Le vétérinaire de <strong>${animal?.name ?? 'votre animal'}</strong> a indiqué un rappel de vaccin à prévoir prochainement :</p>
          <ul style="line-height: 1.8;">
            <li><strong>Vaccin :</strong> ${vaccine.name}</li>
            <li><strong>À faire avant le :</strong> ${dueDateStr}</li>
          </ul>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
        </div>
      `
      await sendReminderEmail(resendKey, ownerEmail, `Rappel de vaccin pour ${animal?.name ?? 'votre animal'}`, html)
    }

    const ownerPhone = toE164(ownerProfile?.phone)
    if (ownerPhone) {
      await sendOvhSms(
        `Animeaux : rappel de vaccin (${vaccine.name}) pour ${animal?.name ?? 'votre animal'} avant le ${dueDateStr}.`,
        ownerPhone
      )
    }

    await supabase.from('vaccines').update({ reminder_sent_at: new Date().toISOString() }).eq('id', vaccine.id)
    vaccineReminders++
  }

  // Rappel "laissez un avis" : quelques heures après qu'un RDV a été
  // marqué terminé par le praticien (bouton "Terminé" sur AppointmentCard,
  // completed_at posé par useUpdateAppointmentStatus) — pas immédiatement,
  // le patient vient probablement de quitter le cabinet. Fenêtre de 3 à 4h
  // après complétion (la fonction tourne toutes les heures), même logique
  // de fenêtre glissante que le rappel de RDV à 24h ci-dessus.
  // review_reminder_sent_at évite tout renvoi.
  const reviewFrom = new Date()
  reviewFrom.setHours(reviewFrom.getHours() - 4)
  const reviewTo = new Date(reviewFrom)
  reviewTo.setHours(reviewTo.getHours() + 1)

  const { data: completedAppointments } = await supabase
    .from('appointments')
    .select(`
      id, doctor_id, patient_id,
      patient:users!patient_id(email, profiles(first_name, phone)),
      doctors!inner(profiles!inner(first_name, last_name))
    `)
    .eq('status', 'completed')
    .is('review_reminder_sent_at', null)
    .gte('completed_at', reviewFrom.toISOString())
    .lt('completed_at', reviewTo.toISOString())

  let reviewReminders = 0
  for (const appt of completedAppointments ?? []) {
    const patientProfile = (appt.patient as any)?.profiles
    const patientEmail = (appt.patient as any)?.email
    const doctorProfile = (appt.doctors as any)?.profiles
    const doctorName = doctorProfile ? `Dr ${doctorProfile.first_name} ${doctorProfile.last_name}` : 'votre praticien'

    await supabase.from('notifications').insert({
      user_id: appt.patient_id,
      type: 'review_reminder',
      title: "Comment s'est passé votre rendez-vous ?",
      body: `Partagez votre avis sur ${doctorName}, ça aide les autres propriétaires d'animaux.`,
      related_id: appt.doctor_id,
    })

    if (resendKey && patientEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
          </div>
          <h2 style="color: #d9670b;">Un avis sur votre rendez-vous ? 🐾</h2>
          <p>Bonjour ${patientProfile?.first_name ?? ''},</p>
          <p>Votre rendez-vous avec <strong>${doctorName}</strong> est terminé. Si vous avez un instant, votre avis aide les autres propriétaires d'animaux à choisir un praticien.</p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
        </div>
      `
      await sendReminderEmail(resendKey, patientEmail, 'Un avis sur votre dernier rendez-vous ?', html)
    }

    const patientPhone = toE164(patientProfile?.phone)
    if (patientPhone) {
      await sendOvhSms(
        `Animeaux : votre RDV avec ${doctorName} est termine. Donnez votre avis sur l'appli !`,
        patientPhone
      )
    }

    await supabase.from('appointments').update({ review_reminder_sent_at: new Date().toISOString() }).eq('id', appt.id)
    reviewReminders++
  }

  return new Response(JSON.stringify({ sent, vaccineReminders, reviewReminders }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
