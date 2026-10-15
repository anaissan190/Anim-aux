// supabase/functions/request-cabinet-quote/quote.ts
// Logique pure de la demande de devis « Grand cabinet » (plus de 5 praticiens) :
// validation du questionnaire et texte des deux emails. Aucun import, donc testable avec
// Vitest (voir quote.test.ts) et utilisable tel quel par la fonction Edge.

export const MIN_PRACTITIONERS = 6 // 5 ou moins : l'abonnement cabinet convient
export const MAX_REQUESTS_PER_DAY = 3
export const NOTIFY_EMAIL_DEFAULT = 'contact@monanimeaux.fr'

export interface QuoteInput {
  clinicName?: unknown
  city?: unknown
  practitionerCount?: unknown
  practitionerCountNextYear?: unknown
  secretaryCount?: unknown
  phone?: unknown
  message?: unknown
  consent?: unknown
}

export interface QuoteValue {
  clinicName: string
  city: string | null
  practitionerCount: number
  practitionerCountNextYear: number | null
  secretaryCount: number
  phone: string | null
  message: string | null
}

export type QuoteErrorCode =
  | 'clinic_name_required' | 'practitioner_count_invalid' | 'too_few_practitioners'
  | 'next_year_invalid' | 'secretary_count_invalid' | 'phone_invalid' | 'consent_required' | 'too_long'

export type QuoteValidation = { ok: true; value: QuoteValue } | { ok: false; error: QuoteErrorCode }

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

// Entier saisi (champ numérique ou texte) ; null si vide ; NaN si invalide.
function wholeNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isInteger(n) ? n : Number.NaN
}

export function validateQuoteRequest(input: QuoteInput | null | undefined): QuoteValidation {
  const i = input ?? {}
  const clinicName = text(i.clinicName)
  if (!clinicName) return { ok: false, error: 'clinic_name_required' }
  if (clinicName.length > 120) return { ok: false, error: 'too_long' }

  const city = text(i.city)
  if (city.length > 80) return { ok: false, error: 'too_long' }

  const count = wholeNumber(i.practitionerCount)
  if (count === null || Number.isNaN(count) || count < 1 || count > 500) return { ok: false, error: 'practitioner_count_invalid' }
  if (count < MIN_PRACTITIONERS) return { ok: false, error: 'too_few_practitioners' }

  const next = wholeNumber(i.practitionerCountNextYear)
  if (next !== null && (Number.isNaN(next) || next < 1 || next > 500)) return { ok: false, error: 'next_year_invalid' }

  const secretaries = wholeNumber(i.secretaryCount)
  if (secretaries !== null && (Number.isNaN(secretaries) || secretaries < 0 || secretaries > 200)) {
    return { ok: false, error: 'secretary_count_invalid' }
  }

  const phone = text(i.phone)
  if (phone && !/^[0-9 +().-]{6,25}$/.test(phone)) return { ok: false, error: 'phone_invalid' }

  const message = text(i.message)
  if (message.length > 2000) return { ok: false, error: 'too_long' }

  if (i.consent !== true) return { ok: false, error: 'consent_required' }

  return {
    ok: true,
    value: {
      clinicName,
      city: city || null,
      practitionerCount: count,
      practitionerCountNextYear: next,
      secretaryCount: secretaries ?? 0,
      phone: phone || null,
      message: message || null,
    },
  }
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Plus de 5 demandes... : une limite par jour et par compte, contre les envois en boucle.
export function tooManyRequests(countLast24h: number): boolean {
  return countLast24h >= MAX_REQUESTS_PER_DAY
}

const row = (label: string, value: string) =>
  `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>`
  + `<td style="padding: 4px 0;">${value}</td></tr>`

export interface QuoteEmailInput {
  value: QuoteValue
  requesterName: string | null | undefined
  requesterEmail: string
  adminUrl?: string
}

// Email envoyé à Anaïs : toutes les réponses, et « Répondre » écrit directement au cabinet
// (reply-to posé par la fonction).
export function buildAdminEmail({ value, requesterName, requesterEmail, adminUrl }: QuoteEmailInput): { subject: string; html: string } {
  const v = value
  const name = requesterName?.trim() || 'Non renseigné'
  const url = adminUrl ?? 'https://monanimeaux.fr/dashboard/admin'
  const rows = [
    row('Cabinet', escapeHtml(v.clinicName)),
    row('Ville', v.city ? escapeHtml(v.city) : 'Non renseignée'),
    row('Praticiens aujourd’hui', String(v.practitionerCount)),
    row('Dans un an', v.practitionerCountNextYear ? String(v.practitionerCountNextYear) : 'Non renseigné'),
    row('Secrétariat', String(v.secretaryCount)),
    row('Contact', `${escapeHtml(name)}<br />${escapeHtml(requesterEmail)}${v.phone ? `<br />${escapeHtml(v.phone)}` : ''}`),
  ].join('')
  const messageBlock = v.message
    ? `<p style="margin: 16px 0 4px; color: #6b7280; font-size: 13px;">Message</p>
       <p style="background: #f9fafb; border-radius: 10px; padding: 12px 16px; margin: 0; white-space: pre-wrap;">${escapeHtml(v.message)}</p>`
    : ''
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #d9670b;">Nouvelle demande de devis — grand cabinet</h2>
      <table style="border-collapse: collapse; font-size: 15px;">${rows}</table>
      ${messageBlock}
      <p style="margin-top: 20px;">
        <a href="${escapeHtml(url)}" style="background: #d9670b; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 500;">
          Ouvrir l'administration
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Répondez directement à cet email pour écrire au cabinet.</p>
    </div>
  `
  return { subject: `Demande de devis : ${v.clinicName} (${v.practitionerCount} praticiens)`, html }
}

// Accusé de réception envoyé au praticien : ce qu'il a demandé, et la suite.
export function buildConfirmationEmail({ value, requesterName }: Pick<QuoteEmailInput, 'value' | 'requesterName'>): { subject: string; html: string } {
  const hello = requesterName?.trim() ? `Bonjour ${escapeHtml(requesterName.trim())},` : 'Bonjour,'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 16px;">
        <img src="https://monanimeaux.fr/pwa-192.png" width="56" height="56" alt="Animéaux" style="border-radius: 14px; display: inline-block;" />
      </div>
      <h2 style="color: #d9670b;">Nous avons bien reçu votre demande</h2>
      <p>${hello}</p>
      <p>Merci pour votre demande de devis pour <strong>${escapeHtml(value.clinicName)}</strong> (${value.practitionerCount} praticiens).</p>
      <p>Nous étudions votre situation et revenons vers vous par email avec une proposition adaptée à la taille de votre équipe. Aucun paiement n'est demandé d'ici là.</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Animéaux — Votre animal, notre priorité.</p>
    </div>
  `
  return { subject: 'Votre demande de devis Animéaux', html }
}
