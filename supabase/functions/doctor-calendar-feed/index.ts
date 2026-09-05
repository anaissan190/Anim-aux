// supabase/functions/doctor-calendar-feed/index.ts
// Flux ICS abonnable (un par praticien) pour synchroniser tout l'agenda
// confirmé dans Google/Apple Calendar, plutôt que d'exporter chaque RDV
// individuellement (voir generateAppointmentIcs, src/lib/ics.ts, pour
// l'export ponctuel côté patient/praticien).
//
// Authentification : les applications calendrier (Google/Apple/Outlook)
// interrogent cette URL directement en arrière-plan, sans jamais envoyer
// le moindre header d'autorisation Supabase — donc PAS de JWT possible
// ici. L'accès est protégé par un jeton opaque dans l'URL
// (doctor_calendar_tokens, migration 086), à la place. Cette fonction DOIT
// avoir "Verify JWT" désactivé dans Supabase Dashboard → Edge Functions →
// doctor-calendar-feed → Settings, sinon la plateforme rejette la requête
// avant même d'atteindre ce code (401 UNAUTHORIZED_INVALID_JWT_FORMAT) —
// même piège que send-reminders, voir CLAUDE.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// RFC 5545 §3.3.11 : \, ; et , doivent être échappés, les retours à la
// ligne remplacés par \n littéral — même règle que src/lib/ics.ts (dupliqué
// ici plutôt que partagé : les Edge Functions Deno n'importent pas le code
// applicatif de src/, voir la convention déjà en place sur toE164 dans les
// autres fonctions de ce dossier).
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

function toIcsUtcDate(isoDate: string): string {
  return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return new Response('token manquant', { status: 400 })
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('doctor_calendar_tokens')
    .select('doctor_id')
    .eq('token', token)
    .single()
  if (tokenError || !tokenRow) {
    return new Response('Jeton invalide', { status: 404 })
  }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('specialty, address, city, profiles!doctors_user_id_profiles_fkey(first_name, last_name)')
    .eq('id', tokenRow.doctor_id)
    .single()
  const doctorProfile = (doctor as any)?.profiles
  const doctorName = doctorProfile ? `Dr ${doctorProfile.first_name} ${doctorProfile.last_name}` : 'Praticien'

  // Agenda confirmé à partir d'hier (couvre un RDV du jour déjà commencé) :
  // pas de borne haute, tout le futur confirmé doit apparaître. Les RDV
  // annulés/terminés ne sont pas des évènements de calendrier utiles ici.
  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select(`
      id, start_at, end_at, reason, notes,
      patient:users!patient_id(profiles(first_name, last_name)),
      appointment_animals(animals(name))
    `)
    .eq('doctor_id', tokenRow.doctor_id)
    .eq('status', 'confirmed')
    .gte('start_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('start_at')
  if (apptError) console.error('appointments query error', apptError)

  const events = (appointments ?? []).map((appt: any) => {
    const patientProfile = appt.patient?.profiles
    const patientName = patientProfile ? `${patientProfile.first_name ?? ''} ${patientProfile.last_name ?? ''}`.trim() : 'Patient'
    const animalNames = (appt.appointment_animals ?? []).map((link: any) => link.animals?.name).filter(Boolean)
    const summary = `${patientName}${animalNames.length ? ` (${animalNames.join(', ')})` : ''}`
    const location = [doctor?.address, doctor?.city].filter(Boolean).join(', ')
    const descriptionParts = [
      appt.reason ? `Motif : ${appt.reason}` : null,
      appt.notes ? `Notes : ${appt.notes}` : null,
    ].filter(Boolean) as string[]

    return [
      'BEGIN:VEVENT',
      `UID:appointment-${appt.id}@monanimeaux.fr`,
      `DTSTAMP:${toIcsUtcDate(new Date().toISOString())}`,
      `DTSTART:${toIcsUtcDate(appt.start_at)}`,
      `DTEND:${toIcsUtcDate(appt.end_at)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      location ? `LOCATION:${escapeIcsText(location)}` : null,
      descriptionParts.length ? `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}` : null,
      'END:VEVENT',
    ].filter((line): line is string => line !== null).join('\r\n')
  })

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Animéaux//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Animéaux — ${doctorName}`)}`,
    // Suggestion de fréquence de rafraîchissement pour les clients qui la
    // respectent (Apple Calendar notamment) ; Google Calendar ignore cet
    // en-tête et applique son propre intervalle, généralement ~24h.
    'X-PUBLISHED-TTL:PT1H',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
})
