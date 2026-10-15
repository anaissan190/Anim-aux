import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toggle from './Toggle'

describe('Toggle', () => {
  it("est un interrupteur nommé par son titre, avec l'explication affichée", () => {
    render(<Toggle checked label="Apparaître dans la recherche" description="Votre fiche est visible." onChange={() => {}} />)
    const sw = screen.getByRole('switch', { name: 'Apparaître dans la recherche' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Votre fiche est visible.')).toBeInTheDocument()
  })

  it("renvoie la valeur inverse au clic", () => {
    const onChange = vi.fn()
    const { rerender } = render(<Toggle checked={false} label="Messagerie" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Messagerie' }))
    expect(onChange).toHaveBeenLastCalledWith(true)
    rerender(<Toggle checked label="Messagerie" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Messagerie' }))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it("ne réagit pas quand il est désactivé", () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} disabled label="Messagerie" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Messagerie' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("fonctionne sans explication", () => {
    render(<Toggle checked={false} label="Déplacement à domicile" onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Déplacement à domicile' })).toHaveAttribute('aria-checked', 'false')
  })
})
