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
      id, start_at, reason,
      profiles!patient_id(first_name, email),
      doctors!inner(profiles!inner(first_name, last_name, specialty))
    `)
    .gte('start_at', from.toISOString())
    .lt('start_at', to.toISOString())
    .eq('status', 'confirmed')

  let sent = 0
  for (const appt of appointments ?? []) {
    // Crée la notification in-app
    await supabase.from('notifications').insert({
      user_id: appt.profiles?.user_id ?? '', // à adapter selon la jointure
      type: 'appointment_reminder',
      title: 'Rappel de rendez-vous',
      body: `Votre RDV avec Dr ${(appt.doctors as any)?.profiles?.last_name} est demain.`,
      related_id: appt.id,
    })

    // TODO: envoyer l'email via Resend
    // const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    // await resend.emails.send({ from: '...', to: appt.profiles?.email, subject: '...', html: '...' })

    sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
