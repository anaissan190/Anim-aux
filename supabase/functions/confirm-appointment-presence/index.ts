// supabase/functions/confirm-appointment-presence/index.ts
// Appelée depuis la page publique /confirmer-presence/:id (voir
// src/pages/ConfirmPresencePage.tsx), elle-même liée dans le rappel de RDV
// à 24h (send-reminders). Volontairement PUBLIQUE (pas de vérification de
// JWT) : le lien est cliqué depuis un email/SMS, souvent sans session
// active sur cet appareil — exiger une connexion tuerait l'usage. L'id du
// RDV (UUID non devinable) sert de jeton d'accès ; l'action possible est
// limitée à poser une seule date (confirmed_by_patient_at), rien d'autre
// n'est exposé ni modifiable.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let appointmentId: string | undefined
  try {
    ({ appointmentId } = await req.json())
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid_body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!appointmentId) {
    return new Response(JSON.stringify({ ok: false, reason: 'missing_id' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: appt, error } = await supabase
    .from('appointments')
    .select('id, start_at, status, confirmed_by_patient_at, doctors!inner(profiles!inner(first_name, last_name))')
    .eq('id', appointmentId)
    .single()

  if (error || !appt) {
    return new Response(JSON.stringify({ ok: false, reason: 'not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const doctorProfile = (appt.doctors as any)?.profiles
  const doctorName = doctorProfile ? `Dr ${doctorProfile.first_name} ${doctorProfile.last_name}` : 'votre praticien'
  const dateStr = new Date(appt.start_at).toLocaleString('fr-FR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris',
  })

  // Un RDV déjà annulé/terminé, ou passé, ne peut plus être "confirmé" —
  // évite un lien encore cliquable après coup qui donnerait un faux
  // sentiment de RDV maintenu.
  if (appt.status !== 'confirmed' || new Date(appt.start_at) < new Date()) {
    return new Response(JSON.stringify({ ok: false, reason: 'not_confirmable', doctorName, dateStr }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Idempotent : un second clic (double-clic, lien rouvert) ne doit pas
  // écraser l'horodatage de la première confirmation ni renvoyer une erreur.
  if (!appt.confirmed_by_patient_at) {
    await supabase
      .from('appointments')
      .update({ confirmed_by_patient_at: new Date().toISOString() })
      .eq('id', appointmentId)
  }

  return new Response(JSON.stringify({ ok: true, doctorName, dateStr }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
