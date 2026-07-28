import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SpeciesSelect from './SpeciesSelect'

describe('SpeciesSelect', () => {
  it('affiche la valeur sélectionnée quand le menu est fermé', () => {
    render(<SpeciesSelect value="Chien" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Rechercher une espèce...')).toHaveValue('Chien')
  })

  it('ouvre le menu au focus et filtre les espèces à la saisie', () => {
    render(<SpeciesSelect value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Rechercher une espèce...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'chat' } })
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.queryByText('Cheval')).not.toBeInTheDocument()
  })

  it('affiche un message si aucune espèce ne correspond', () => {
    render(<SpeciesSelect value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Rechercher une espèce...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzzzz' } })
    expect(screen.getByText('Aucune espèce trouvée.')).toBeInTheDocument()
  })

  it('appelle onChange et referme le menu à la sélection d\'une espèce', () => {
    const onChange = vi.fn()
    render(<SpeciesSelect value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText('Rechercher une espèce...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'chat' } })
    fireEvent.click(screen.getByText('Chat'))
    expect(onChange).toHaveBeenCalledWith('Chat')
    expect(screen.queryByText('Aucune espèce trouvée.')).not.toBeInTheDocument()
  })

  it('propose toujours "Autre..." même avec une recherche filtrée', () => {
    const onChange = vi.fn()
    render(<SpeciesSelect value="" onChange={onChange} />)
    fireEvent.focus(screen.getByPlaceholderText('Rechercher une espèce...'))
    fireEvent.click(screen.getByText('Autre...'))
    expect(onChange).toHaveBeenCalledWith('Autre')
  })

  it('referme le menu et réinitialise la recherche au clic en dehors', () => {
    render(
      <div>
        <SpeciesSelect value="Chien" onChange={vi.fn()} />
        <button>Ailleurs</button>
      </div>
    )
    const input = screen.getByPlaceholderText('Rechercher une espèce...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'chat' } })
    expect(screen.getByText('Chat')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText('Ailleurs'))

    expect(screen.queryByText('Chat')).not.toBeInTheDocument()
    expect(input).toHaveValue('Chien') // revient à la valeur sélectionnée, pas la recherche
  })
})
