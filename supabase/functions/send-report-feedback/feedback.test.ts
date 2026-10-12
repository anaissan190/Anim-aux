import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DELETE_NOTE, adminComment, buildFeedbackEmail, escapeHtml, excerpt, feedbackOutcome, outcomeText, stars,
} from './feedback'

describe('feedbackOutcome', () => {
  it('traité + avis disparu = avis supprimé', () => {
    expect(feedbackOutcome('resolved', false)).toBe('deleted')
  })
  it('traité + avis toujours là = avis conservé', () => {
    expect(feedbackOutcome('resolved', true)).toBe('kept')
  })
  it('rejeté = signalement non retenu, que l\'avis existe ou non', () => {
    expect(feedbackOutcome('dismissed', true)).toBe('dismissed')
    expect(feedbackOutcome('dismissed', false)).toBe('dismissed')
  })
})

describe('adminComment', () => {
  it('renvoie le commentaire écrit par l\'admin, sans espaces autour', () => {
    expect(adminComment('  Propos injurieux confirmés.  ')).toBe('Propos injurieux confirmés.')
  })
  it('ignore une note vide ou absente', () => {
    expect(adminComment('')).toBeNull()
    expect(adminComment('   ')).toBeNull()
    expect(adminComment(null)).toBeNull()
    expect(adminComment(undefined)).toBeNull()
  })
  it('ignore la note automatique de suppression', () => {
    expect(adminComment(DEFAULT_DELETE_NOTE)).toBeNull()
  })
})

describe('outcomeText', () => {
  it('a un titre et un texte pour chaque issue', () => {
    for (const o of ['deleted', 'kept', 'dismissed'] as const) {
      const t = outcomeText(o)
      expect(t.title.length).toBeGreaterThan(0)
      expect(t.body.length).toBeGreaterThan(0)
    }
    expect(outcomeText('deleted').title).toMatch(/supprimé/)
    expect(outcomeText('dismissed').title).toMatch(/pas été retenu/)
  })
})

describe('stars / excerpt / escapeHtml', () => {
  it('dessine une note sur 5 et borne les valeurs aberrantes', () => {
    expect(stars(4)).toBe('★★★★☆')
    expect(stars(0)).toBe('☆☆☆☆☆')
    expect(stars(9)).toBe('★★★★★')
    expect(stars(null)).toBe('☆☆☆☆☆')
  })
  it('coupe un long texte avec une ellipse', () => {
    expect(excerpt('abc', 10)).toBe('abc')
    expect(excerpt('a'.repeat(20), 10)).toBe('a'.repeat(10) + '…')
    expect(excerpt(null)).toBe('')
  })
  it('échappe le HTML', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
  })
})

describe('buildFeedbackEmail', () => {
  const base = { firstName: 'Gary', outcome: 'deleted' as const, note: null, reason: 'Propos injurieux', review: { rating: 1, comment: 'Nul' } }

  it('annonce l\'issue, rappelle l\'avis et le motif', () => {
    const { subject, html } = buildFeedbackEmail(base)
    expect(subject).toMatch(/signalement/)
    expect(html).toContain('Bonjour Gary,')
    expect(html).toContain("L&#39;avis a été supprimé")
    expect(html).toContain('★☆☆☆☆')
    expect(html).toContain('« Nul »')
    expect(html).toContain('Propos injurieux')
  })

  it('montre le message de l\'équipe seulement s\'il y en a un', () => {
    expect(buildFeedbackEmail({ ...base, note: 'Avis supprimé' }).html).not.toContain("Le message de l'équipe")
    expect(buildFeedbackEmail({ ...base, note: '' }).html).not.toContain("Le message de l'équipe")
    const withNote = buildFeedbackEmail({ ...base, note: 'Merci pour votre vigilance.' }).html
    expect(withNote).toContain("Le message de l'équipe Animéaux")
    expect(withNote).toContain('Merci pour votre vigilance.')
  })

  it('échappe le contenu saisi par l\'admin et par les utilisateurs', () => {
    const { html } = buildFeedbackEmail({
      ...base, firstName: '<img>', note: '<script>alert(1)</script>', reason: '<b>x</b>',
      review: { rating: 3, comment: '<i>avis</i>' },
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img>')
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<i>avis</i>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('reste valide sans prénom, sans avis rappelé et sans motif', () => {
    const { html } = buildFeedbackEmail({ firstName: null, outcome: 'dismissed', note: null, reason: null, review: null })
    expect(html).toContain('Bonjour,')
    expect(html).not.toContain('Avis concerné')
    expect(html).not.toContain('Votre motif')
    expect(html).toContain("pas été retenu")
  })
})
