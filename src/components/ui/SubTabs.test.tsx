import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubTabs from './SubTabs'

const items = [
  { id: 'a', label: 'Mon profil' },
  { id: 'b', label: 'Équipe', count: 6 },
  { id: 'c', label: 'Statistiques' },
]

describe('SubTabs', () => {
  it("affiche les onglets, marque l'actif et montre le nombre quand il y en a un", () => {
    render(<SubTabs items={items} value="b" onChange={() => {}} label="Sections" />)
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Équipe/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Mon profil' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /Équipe/ })).toHaveTextContent('6')
  })

  it('change de section au clic', () => {
    const onChange = vi.fn()
    render(<SubTabs items={items} value="a" onChange={onChange} label="Sections" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Statistiques' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it("se parcourt aux flèches du clavier, en boucle", () => {
    const onChange = vi.fn()
    const { rerender } = render(<SubTabs items={items} value="a" onChange={onChange} label="Sections" />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Mon profil' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('b')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Mon profil' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('c') // revient à la fin
    rerender(<SubTabs items={items} value="c" onChange={onChange} label="Sections" />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Statistiques' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('a') // repart au début
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Statistiques' }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(3) // les autres touches ne font rien
  })

  it("seul l'onglet actif est dans l'ordre de tabulation", () => {
    render(<SubTabs items={items} value="a" onChange={() => {}} label="Sections" />)
    expect(screen.getByRole('tab', { name: 'Mon profil' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Statistiques' })).toHaveAttribute('tabindex', '-1')
  })
})
