// src/lib/sanitizeHtml.ts
// Nettoie un HTML généré par l'éditeur de texte enrichi (bio praticien).
// La bio est affichée publiquement (fiche praticien visible sans connexion),
// donc on retire tout ce qui n'est pas une simple mise en forme de texte :
// pas d'attributs (onclick, style, href javascript:...), pas de scripts/iframes.

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P', 'DIV'])
const REMOVE_ENTIRELY = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'])

function sanitizeNode(node: Element) {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) {
      node.removeChild(child)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as Element

    if (REMOVE_ENTIRELY.has(el.tagName)) {
      el.remove()
      continue
    }

    // Retire tous les attributs : élimine onclick, style, href="javascript:...", etc.
    while (el.attributes.length > 0) {
      el.removeAttribute(el.attributes[0].name)
    }

    if (!ALLOWED_TAGS.has(el.tagName)) {
      // Nettoie D'ABORD le sous-arbre, avant de dépiler — sinon un contenu
      // dangereux niché dans une balise non autorisée (ex. <a><img
      // onerror=...></a>) survivait intact : la boucle ci-dessus ne
      // repassait jamais sur les enfants tout juste remontés dans `node`.
      sanitizeNode(el)
      while (el.firstChild) node.insertBefore(el.firstChild, el)
      node.removeChild(el)
      continue
    }

    sanitizeNode(el)
  }
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  const container = document.createElement('div')
  container.innerHTML = html
  sanitizeNode(container)
  return container.innerHTML
}
