import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PasswordInput from './PasswordInput'

describe('PasswordInput', () => {
  it('masque le mot de passe par défaut', () => {
    render(<PasswordInput placeholder="Mot de passe" />)
    expect(screen.getByPlaceholderText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('bascule vers un champ texte visible au clic sur l\'œil', () => {
    render(<PasswordInput placeholder="Mot de passe" />)
    fireEvent.click(screen.getByLabelText('Afficher le mot de passe'))
    expect(screen.getByPlaceholderText('Mot de passe')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Masquer le mot de passe')).toBeInTheDocument()
  })

  it('revient à masqué si on clique une seconde fois', () => {
    render(<PasswordInput placeholder="Mot de passe" />)
    const toggle = () => fireEvent.click(screen.getByRole('button'))
    toggle()
    toggle()
    expect(screen.getByPlaceholderText('Mot de passe')).toHaveAttribute('type', 'password')
  })
})
