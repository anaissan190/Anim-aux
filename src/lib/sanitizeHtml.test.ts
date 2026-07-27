import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('conserve le texte brut et les balises de mise en forme autorisées', () => {
    expect(sanitizeHtml('<p>Bonjour <strong>Anaïs</strong></p>')).toBe('<p>Bonjour <strong>Anaïs</strong></p>')
    expect(sanitizeHtml('<ul><li>un</li><li>deux</li></ul>')).toBe('<ul><li>un</li><li>deux</li></ul>')
  })

  it('supprime entièrement les balises <script> et leur contenu', () => {
    expect(sanitizeHtml('<p>Bio</p><script>alert(1)</script>')).toBe('<p>Bio</p>')
  })

  it('supprime les autres balises dangereuses (iframe, style, object, embed)', () => {
    expect(sanitizeHtml('<iframe src="evil.com"></iframe>Texte')).toBe('Texte')
    expect(sanitizeHtml('<style>body{display:none}</style>Texte')).toBe('Texte')
    expect(sanitizeHtml('<object data="evil.swf"></object>Texte')).toBe('Texte')
  })

  it('retire tous les attributs des balises autorisées (onclick, style...)', () => {
    expect(sanitizeHtml('<p onclick="alert(1)" style="color:red">Texte</p>')).toBe('<p>Texte</p>')
  })

  it('dépile les balises non autorisées mais garde leur contenu texte', () => {
    // <span> et <a> ne sont pas dans ALLOWED_TAGS : la balise disparaît,
    // le texte à l'intérieur reste (donc un lien javascript: perd son href
    // en même temps que la balise <a> elle-même).
    expect(sanitizeHtml('<span>Texte</span>')).toBe('Texte')
    expect(sanitizeHtml('<a href="javascript:alert(1)">Cliquez ici</a>')).toBe('Cliquez ici')
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">Texte')).toBe('Texte')
  })

  it('nettoie récursivement les balises imbriquées', () => {
    expect(sanitizeHtml('<div onclick="alert(1)"><script>alert(2)</script>Bonjour</div>'))
      .toBe('<div>Bonjour</div>')
  })

  it('supprime les commentaires HTML', () => {
    expect(sanitizeHtml('<p>Texte<!-- commentaire --></p>')).toBe('<p>Texte</p>')
  })
})
