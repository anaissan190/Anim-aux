// src/lib/ics.ts

export interface IcsAppointmentInput {
  id: string
  startAt: string
  endAt: string
  doctorName: string
  specialty?: string
  address?: string
  city?: string
  reason?: string
}

// RFC 5545 §3.3.11 : \, ; et , doivent être échappés, les retours à la
// ligne remplacés par \n littéral.
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

export function generateAppointmentIcs(appt: IcsAppointmentInput): string {
  const summary = `RDV avec ${appt.doctorName}${appt.specialty ? ` (${appt.specialty})` : ''}`
  const location = [appt.address, appt.city].filter(Boolean).join(', ')
  const descriptionParts = [
    appt.reason ? `Motif : ${appt.reason}` : null,
    'Pris via Animéaux',
  ].filter(Boolean) as string[]

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Animéaux//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:appointment-${appt.id}@monanimeaux.fr`,
    `DTSTAMP:${toIcsUtcDate(new Date().toISOString())}`,
    `DTSTART:${toIcsUtcDate(appt.startAt)}`,
    `DTEND:${toIcsUtcDate(appt.endAt)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => line !== null)

  return lines.join('\r\n')
}
