import { describe, it, expect } from 'vitest'
import { computeResizedDimensions } from './compressImage'

describe('computeResizedDimensions', () => {
  it('ne change rien si l\'image est déjà plus petite que le maximum', () => {
    expect(computeResizedDimensions(400, 300, 900)).toEqual({ width: 400, height: 300 })
  })

  it('ne change rien si l\'image fait exactement le maximum', () => {
    expect(computeResizedDimensions(900, 600, 900)).toEqual({ width: 900, height: 600 })
  })

  it('réduit une image large en gardant le ratio', () => {
    // 4000x2000 -> plus grand côté (4000) ramené à 900, ratio 2:1 conservé
    expect(computeResizedDimensions(4000, 2000, 900)).toEqual({ width: 900, height: 450 })
  })

  it('réduit une image en portrait en gardant le ratio', () => {
    // 2000x4000 -> plus grand côté (4000) ramené à 900, ratio 1:2 conservé
    expect(computeResizedDimensions(2000, 4000, 900)).toEqual({ width: 450, height: 900 })
  })

  it('gère une image carrée', () => {
    expect(computeResizedDimensions(3000, 3000, 900)).toEqual({ width: 900, height: 900 })
  })
})
