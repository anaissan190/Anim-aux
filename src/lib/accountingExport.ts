// src/lib/accountingExport.ts
// Export comptable mensuel (onglet Statistiques du praticien) : une ligne par
// consultation TERMINÉE du mois, au format CSV lisible par Excel en français
// (séparateur ";", BOM UTF-8, virgule décimale). Le montant est le tarif de
// consultation du praticien — une réservation ne garde pas la prestation
// exacte choisie, donc c'est une estimation, pas un justificatif comptable.
import { formatInTimeZone } from 'date-fns-tz'
import { PARIS_TZ, parisMonthKey } from './parisTime'

export interface ExportAppointment {
  doctor_id?: string
  start_at: string
  status: string
  reason?: string
  profiles?: { first_name?: string; last_name?: string } | null
  animals?: { name?: string }[]
}

export const EXPORT_HEADERS = ['Date', 'Heure', 'Patient', 'Animaux', 'Motif', 'Montant (€)']

// Neutralise l'injection de formule (=, +, -, @ en début de cellule sont
// interprétés par Excel comme une formule — un nom ou motif saisi par un
// patient ne doit jamais s'exécuter) puis échappe pour le CSV.
export function csvCell(value: string): string {
  let v = value.replace(/[\r\n]+/g, ' ')
  if (/^[=+\-@\t]/.test(v)) v = `'${v}`
  return /[";]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

const euros = (n: number) => n.toFixed(2).replace('.', ',')

// `price` : un tarif unique, ou le tarif de chaque RDV (cabinet : un tarif par praticien).
type ExportPrice = number | ((appointment: { doctor_id?: string }) => number)

function priceOf(price: ExportPrice, a: ExportAppointment): number {
  return (typeof price === 'function' ? price(a) : price) || 0
}

function completedInMonth(appointments: ExportAppointment[], monthKey: string): ExportAppointment[] {
  return appointments
    .filter(a => a.status === 'completed' && parisMonthKey(new Date(a.start_at)) === monthKey)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
}

export function buildAccountingRows(appointments: ExportAppointment[], monthKey: string, price: ExportPrice): string[][] {
  return completedInMonth(appointments, monthKey)
    .map(a => {
      const d = new Date(a.start_at)
      return [
        formatInTimeZone(d, PARIS_TZ, 'dd/MM/yyyy'),
        formatInTimeZone(d, PARIS_TZ, 'HH:mm'),
        `${a.profiles?.first_name ?? ''} ${a.profiles?.last_name ?? ''}`.trim(),
        (a.animals ?? []).map(an => an.name).filter(Boolean).join(', '),
        a.reason?.split(' — ')[0].trim() ?? '',
        euros(priceOf(price, a)),
      ]
    })
}

export function buildAccountingCsv(appointments: ExportAppointment[], monthKey: string, price: ExportPrice): string {
  const rows = buildAccountingRows(appointments, monthKey, price)
  const sum = completedInMonth(appointments, monthKey).reduce((t, a) => t + priceOf(price, a), 0)
  const total = ['TOTAL', '', '', '', `${rows.length} consultation(s)`, euros(sum)]
  const lines = [EXPORT_HEADERS, ...rows, total].map(r => r.map(csvCell).join(';'))
  return '﻿' + lines.join('\r\n')
}
