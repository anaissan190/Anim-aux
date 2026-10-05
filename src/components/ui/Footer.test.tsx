import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Footer from './Footer'

describe('Footer', () => {
  it('affiche les liens légaux requis', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>)
    expect(screen.getByText("Conditions Générales d'Utilisation").closest('a')).toHaveAttribute('href', '/cgu')
    expect(screen.getByText('Politique de confidentialité').closest('a')).toHaveAttribute('href', '/confidentialite')
    expect(screen.getByText('Mentions légales').closest('a')).toHaveAttribute('href', '/mentions-legales')
  })

  it('affiche l\'année en cours dans le copyright', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>)
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument()
  })
})
