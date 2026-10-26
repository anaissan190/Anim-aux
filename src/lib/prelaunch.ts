// src/lib/prelaunch.ts
// Phase de pré-lancement (migration 137) : avant l'ouverture aux propriétaires, les praticiens
// créent un compte et indiquent la formule qui les intéresse, sans aucun paiement.
// Les réglages (phase, date d'ouverture, seuil) vivent dans la table app_settings : aucune date
// n'est codée en dur ici.
export type LaunchPhase = 'open' | 'prelaunch'
export type IntendedPlan = 'free' | 'pro' | 'cabinet'

export interface LaunchSettings {
  phase: LaunchPhase
  // 'AAAA-MM-JJ', ou null tant qu'aucune date n'est décidée.
  publicLaunchDate: string | null
}

// Valeur par défaut : le comportement actuel du site. Sert aussi en cas d'erreur de lecture,
// pour qu'un incident ne ferme jamais le site aux propriétaires.
export const DEFAULT_LAUNCH_SETTINGS: LaunchSettings = { phase: 'open', publicLaunchDate: null }

export const INTENDED_PLAN_LABEL: Record<IntendedPlan, string> = {
  free: 'Gratuite',
  pro: 'Abonnement',
  cabinet: 'Abonnement cabinet',
}

// 'AAAA-MM-JJ' qui désigne un vrai jour du calendrier (2027-13-45 est refusé, pas arrondi).
export function isValidIsoDate(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function parseLaunchSettings(rows: { key: string; value: string }[] | null | undefined): LaunchSettings {
  const map = new Map((rows ?? []).map(r => [r.key, r.value]))
  const date = map.get('public_launch_date') ?? ''
  return {
    phase: map.get('launch_phase') === 'prelaunch' ? 'prelaunch' : 'open',
    publicLaunchDate: isValidIsoDate(date) ? date : null,
  }
}

export function isIntendedPlan(value: unknown): value is IntendedPlan {
  return value === 'free' || value === 'pro' || value === 'cabinet'
}

// Date d'ouverture lisible (« 15 janvier » ; l'année n'apparaît que si elle n'est pas l'année
// courante). Sans date décidée, texte neutre.
export function formatLaunchDate(iso: string | null, now: Date = new Date()): string | null {
  if (!isValidIsoDate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  const sameYear = y === now.getUTCFullYear()
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  }).format(date)
}

// « Ouverture le 15 janvier » / « Ouverture bientôt ».
export function launchLabel(iso: string | null, now: Date = new Date()): string {
  const f = formatLaunchDate(iso, now)
  return f ? `Ouverture le ${f}` : 'Ouverture bientôt'
}

// Jours restants avant la date d'ouverture (0 le jour même, null sans date ou si elle est passée).
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!isValidIsoDate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const diff = Math.round((target - today) / 86_400_000)
  return diff >= 0 ? diff : null
}

// Avancement vers le seuil de praticiens, en pourcentage plafonné à 100. Sans seuil valide
// (vide, 0, négatif), pas de jauge : null.
export function thresholdProgress(total: number, threshold: number | null): number | null {
  if (threshold == null || !Number.isFinite(threshold) || threshold <= 0) return null
  return Math.min(100, Math.round((total / threshold) * 100))
}

export function parseThreshold(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw.trim())) return null
  const n = Number(raw)
  return n > 0 ? n : null
}

export interface PrelaunchRow {
  first_name: string | null
  last_name: string | null
  email: string | null
  specialties: string[] | null
  city: string | null
  verification_status: string | null
  intended_plan: string | null
  created_at: string
}

const VERIFICATION_LABEL: Record<string, string> = {
  pending: 'En attente', verified: 'Validé', rejected: 'Rejeté',
}

// Les cellules commençant par = + - @ sont préfixées d'une apostrophe : un tableur les
// interpréterait sinon comme une formule (un nom ou une ville saisis par un tiers).
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// Export CSV (séparateur « ; » pour l'ouverture directe dans Excel en version française).
export function prelaunchToCsv(rows: PrelaunchRow[]): string {
  const header = ['Prénom', 'Nom', 'Email', 'Métiers', 'Ville', 'Dossier', 'Formule souhaitée', 'Inscrit le']
  const lines = rows.map(r => [
    r.first_name ?? '',
    r.last_name ?? '',
    r.email ?? '',
    (r.specialties ?? []).join(', '),
    r.city ?? '',
    VERIFICATION_LABEL[r.verification_status ?? ''] ?? '',
    isIntendedPlan(r.intended_plan) ? INTENDED_PLAN_LABEL[r.intended_plan] : 'Pas encore choisie',
    r.created_at.slice(0, 10),
  ].map(csvCell).join(';'))
  return '﻿' + [header.join(';'), ...lines].join('\r\n')
}
