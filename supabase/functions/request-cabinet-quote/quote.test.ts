// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  validateQuoteRequest, tooManyRequests, buildAdminEmail, buildConfirmationEmail, escapeHtml,
  MIN_PRACTITIONERS, MAX_REQUESTS_PER_DAY,
} from './quote'

const valid = {
  clinicName: 'Clinique des Lilas', city: 'Lyon', practitionerCount: 8, practitionerCountNextYear: 10,
  secretaryCount: 2, phone: '06 12 34 56 78', message: 'Nous cherchons une solution pour tous nos sites.', consent: true,
}

describe('validateQuoteRequest', () => {
  it('accepte un questionnaire complet', () => {
    expect(validateQuoteRequest(valid)).toEqual({
      ok: true,
      value: {
        clinicName: 'Clinique des Lilas', city: 'Lyon', practitionerCount: 8, practitionerCountNextYear: 10,
        secretaryCount: 2, phone: '06 12 34 56 78', message: 'Nous cherchons une solution pour tous nos sites.',
      },
    })
  })

  it('accepte le minimum : nom, nombre de praticiens et consentement', () => {
    const r = validateQuoteRequest({ clinicName: ' Cabinet Nord ', practitionerCount: '7', consent: true })
    expect(r).toEqual({
      ok: true,
      value: { clinicName: 'Cabinet Nord', city: null, practitionerCount: 7, practitionerCountNextYear: null, secretaryCount: 0, phone: null, message: null },
    })
  })

  it("exige le nom du cabinet", () => {
    expect(validateQuoteRequest({ ...valid, clinicName: '   ' })).toEqual({ ok: false, error: 'clinic_name_required' })
    expect(validateQuoteRequest({ ...valid, clinicName: undefined })).toEqual({ ok: false, error: 'clinic_name_required' })
  })

  it("renvoie vers l'abonnement cabinet quand il y a 5 praticiens ou moins", () => {
    expect(MIN_PRACTITIONERS).toBe(6)
    expect(validateQuoteRequest({ ...valid, practitionerCount: 5 })).toEqual({ ok: false, error: 'too_few_practitioners' })
    expect(validateQuoteRequest({ ...valid, practitionerCount: 6 }).ok).toBe(true)
  })

  it('refuse un nombre de praticiens absent, décimal, négatif ou absurde', () => {
    for (const bad of [undefined, '', 'abc', 7.5, 0, -3, 501]) {
      expect(validateQuoteRequest({ ...valid, practitionerCount: bad })).toEqual({ ok: false, error: 'practitioner_count_invalid' })
    }
  })

  it("vérifie les autres nombres seulement s'ils sont renseignés", () => {
    expect(validateQuoteRequest({ ...valid, practitionerCountNextYear: '', secretaryCount: '' }).ok).toBe(true)
    expect(validateQuoteRequest({ ...valid, practitionerCountNextYear: 'x' })).toEqual({ ok: false, error: 'next_year_invalid' })
    expect(validateQuoteRequest({ ...valid, secretaryCount: -1 })).toEqual({ ok: false, error: 'secretary_count_invalid' })
  })

  it('contrôle le téléphone sans être trop strict sur le format', () => {
    expect(validateQuoteRequest({ ...valid, phone: '+33 6 12 34 56 78' }).ok).toBe(true)
    expect(validateQuoteRequest({ ...valid, phone: '' }).ok).toBe(true)
    expect(validateQuoteRequest({ ...valid, phone: 'rappelez-moi' })).toEqual({ ok: false, error: 'phone_invalid' })
  })

  it('exige le consentement explicite', () => {
    expect(validateQuoteRequest({ ...valid, consent: false })).toEqual({ ok: false, error: 'consent_required' })
    expect(validateQuoteRequest({ ...valid, consent: 'true' })).toEqual({ ok: false, error: 'consent_required' })
    expect(validateQuoteRequest({ ...valid, consent: undefined })).toEqual({ ok: false, error: 'consent_required' })
  })

  it('limite la taille des textes', () => {
    expect(validateQuoteRequest({ ...valid, message: 'a'.repeat(2001) })).toEqual({ ok: false, error: 'too_long' })
    expect(validateQuoteRequest({ ...valid, clinicName: 'a'.repeat(121) })).toEqual({ ok: false, error: 'too_long' })
    expect(validateQuoteRequest({ ...valid, city: 'a'.repeat(81) })).toEqual({ ok: false, error: 'too_long' })
  })

  it("ne plante pas sur une entrée vide ou nulle", () => {
    expect(validateQuoteRequest(null)).toEqual({ ok: false, error: 'clinic_name_required' })
    expect(validateQuoteRequest(undefined)).toEqual({ ok: false, error: 'clinic_name_required' })
  })
})

describe('tooManyRequests', () => {
  it(`bloque à partir de ${MAX_REQUESTS_PER_DAY} demandes en 24 h`, () => {
    expect(tooManyRequests(0)).toBe(false)
    expect(tooManyRequests(MAX_REQUESTS_PER_DAY - 1)).toBe(false)
    expect(tooManyRequests(MAX_REQUESTS_PER_DAY)).toBe(true)
  })
})

describe('emails', () => {
  const value = (validateQuoteRequest(valid) as any).value

  it("l'email à Anaïs reprend toutes les réponses et le contact", () => {
    const { subject, html } = buildAdminEmail({ value, requesterName: 'Léa Martin', requesterEmail: 'lea@example.org' })
    expect(subject).toBe('Demande de devis : Clinique des Lilas (8 praticiens)')
    for (const s of ['Clinique des Lilas', 'Lyon', '>8<', '>10<', '>2<', 'Léa Martin', 'lea@example.org', '06 12 34 56 78', 'tous nos sites', '/dashboard/admin']) {
      expect(html).toContain(s)
    }
  })

  it("signale les champs non renseignés au lieu de les omettre", () => {
    const v = (validateQuoteRequest({ clinicName: 'X', practitionerCount: 9, consent: true }) as any).value
    const { html } = buildAdminEmail({ value: v, requesterName: null, requesterEmail: 'a@b.fr' })
    expect(html).toContain('Non renseignée')
    expect(html).toContain('Non renseigné')
    expect(html).not.toContain('Message')
  })

  it("neutralise le HTML saisi par le cabinet", () => {
    const v = { ...value, clinicName: '<script>alert(1)</script>', message: '<img src=x onerror=alert(1)>' }
    const { html } = buildAdminEmail({ value: v, requesterName: '<b>x</b>', requesterEmail: 'a@b.fr' })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it("l'accusé de réception rassure : pas de paiement, réponse par email", () => {
    const { subject, html } = buildConfirmationEmail({ value, requesterName: 'Léa' })
    expect(subject).toBe('Votre demande de devis Animéaux')
    expect(html).toContain('Bonjour Léa,')
    expect(html).toContain('Clinique des Lilas')
    expect(html).toContain("Aucun paiement n'est demandé")
    expect(buildConfirmationEmail({ value, requesterName: null }).html).toContain('Bonjour,')
  })

  it('escapeHtml neutralise les caractères spéciaux', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})
