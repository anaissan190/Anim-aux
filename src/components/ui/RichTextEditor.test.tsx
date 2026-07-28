import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RichTextEditor from './RichTextEditor'

// jsdom n'implémente pas document.execCommand — on le stub nous-mêmes pour
// pouvoir vérifier que les boutons de la barre d'outils l'appellent bien
// avec la bonne commande.
beforeEach(() => {
  document.execCommand = vi.fn()
})

describe('RichTextEditor', () => {
  it('affiche le placeholder quand la valeur est vide', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} placeholder="Votre bio..." />)
    expect(screen.getByText('Votre bio...')).toBeInTheDocument()
  })

  it('affiche le placeholder quand la valeur ne contient qu\'un <br> (éditeur "visuellement vide")', () => {
    render(<RichTextEditor value="<br>" onChange={vi.fn()} placeholder="Votre bio..." />)
    expect(screen.getByText('Votre bio...')).toBeInTheDocument()
  })

  it('masque le placeholder dès qu\'il y a du contenu', () => {
    render(<RichTextEditor value="<p>Bonjour</p>" onChange={vi.fn()} placeholder="Votre bio..." />)
    expect(screen.queryByText('Votre bio...')).not.toBeInTheDocument()
  })

  it('synchronise le HTML initial dans la zone éditable au montage', () => {
    const { container } = render(<RichTextEditor value="<p>Contenu initial</p>" onChange={vi.fn()} />)
    expect(container.querySelector('[contenteditable]')?.innerHTML).toBe('<p>Contenu initial</p>')
  })

  it('appelle onChange avec le HTML nettoyé à la saisie', () => {
    const onChange = vi.fn()
    const { container } = render(<RichTextEditor value="" onChange={onChange} />)
    const editable = container.querySelector('[contenteditable]') as HTMLElement
    editable.innerHTML = '<p onclick="alert(1)">Nouveau texte</p>'
    fireEvent.input(editable)
    expect(onChange).toHaveBeenCalledWith('<p>Nouveau texte</p>') // onclick nettoyé par sanitizeHtml
  })

  it('appelle onChange également au blur', () => {
    const onChange = vi.fn()
    const { container } = render(<RichTextEditor value="" onChange={onChange} />)
    const editable = container.querySelector('[contenteditable]') as HTMLElement
    editable.innerHTML = '<p>Texte</p>'
    fireEvent.blur(editable)
    expect(onChange).toHaveBeenCalledWith('<p>Texte</p>')
  })

  it('les boutons de mise en forme appellent document.execCommand avec la bonne commande', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('B'))
    expect(document.execCommand).toHaveBeenCalledWith('bold', false)
    fireEvent.click(screen.getByText('I'))
    expect(document.execCommand).toHaveBeenCalledWith('italic', false)
    fireEvent.click(screen.getByText('U'))
    expect(document.execCommand).toHaveBeenCalledWith('underline', false)
  })
})
