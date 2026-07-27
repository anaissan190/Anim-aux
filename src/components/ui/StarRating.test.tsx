import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import StarRating from './StarRating'

// Le remplissage de chaque étoile est porté par la largeur inline (%) du
// calque ambre superposé à l'étoile grise — pas de rôle/texte accessible
// dédié, donc on lit directement style.width comme la source de vérité du
// composant (voir le commentaire dans StarRating.tsx sur le calcul).
// Sélecteurs par classe plutôt que par profondeur DOM, pour rester robuste
// à un changement de structure interne du composant.
function starWrappers(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.relative'))
}
function fillPercentages(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.overflow-hidden'))
    .map(el => parseFloat(el.style.width))
}

describe('StarRating — affichage non interactif', () => {
  it('remplit entièrement les étoiles inférieures à la note', () => {
    const { container } = render(<StarRating rating={3} />)
    expect(fillPercentages(container)).toEqual([100, 100, 100, 0, 0])
  })

  it('remplit partiellement l\'étoile à cheval sur une note décimale', () => {
    const { container } = render(<StarRating rating={3.5} />)
    expect(fillPercentages(container)).toEqual([100, 100, 100, 50, 0])
  })

  it('ne dépasse jamais 100% même avec une note supérieure au maximum', () => {
    const { container } = render(<StarRating rating={7} max={5} />)
    expect(fillPercentages(container)).toEqual([100, 100, 100, 100, 100])
  })

  it('ne descend jamais sous 0% avec une note nulle ou négative', () => {
    const { container } = render(<StarRating rating={0} />)
    expect(fillPercentages(container)).toEqual([0, 0, 0, 0, 0])
  })

  it('respecte un nombre d\'étoiles personnalisé (max)', () => {
    const { container } = render(<StarRating rating={2} max={3} />)
    expect(fillPercentages(container)).toHaveLength(3)
  })
})

describe('StarRating — mode interactif', () => {
  it('arrondit la note affichée (pas de demi-étoile en mode interactif)', () => {
    const { container } = render(<StarRating rating={3.5} interactive />)
    // Math.round(3.5) = 4 : les 4 premières étoiles pleines, pas de moitié.
    expect(fillPercentages(container)).toEqual([100, 100, 100, 100, 0])
  })

  it('appelle onChange avec la note correspondant à l\'étoile cliquée', () => {
    const onChange = vi.fn()
    const { container } = render(<StarRating rating={0} interactive onChange={onChange} />)
    fireEvent.click(starWrappers(container)[2]) // 3e étoile → note 3
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('n\'appelle jamais onChange en mode non interactif', () => {
    const onChange = vi.fn()
    const { container } = render(<StarRating rating={0} onChange={onChange} />)
    fireEvent.click(starWrappers(container)[2])
    expect(onChange).not.toHaveBeenCalled()
  })
})
