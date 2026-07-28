import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// react-leaflet manipule le vrai DOM (mesures, tuiles, ResizeObserver) d'une
// façon peu fiable sous jsdom — on mocke ses composants par de simples
// pass-through pour vérifier que LocationMap leur transmet les bonnes props,
// sans dépendre du rendu réel d'une carte.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ center, zoom, children }: any) => (
    <div data-testid="map" data-center={JSON.stringify(center)} data-zoom={zoom}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position, children }: any) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>{children}</div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}))
vi.mock('leaflet', () => ({ default: { divIcon: vi.fn(() => ({})) } }))

import LocationMap from './LocationMap'

describe('LocationMap', () => {
  it('centre la carte sur les coordonnées données, avec un zoom fixe de 15', () => {
    render(<LocationMap lat={48.85} lng={2.35} label="Cabinet du Parc" />)
    const map = screen.getByTestId('map')
    expect(map).toHaveAttribute('data-center', JSON.stringify([48.85, 2.35]))
    expect(map).toHaveAttribute('data-zoom', '15')
  })

  it('place le marqueur aux mêmes coordonnées que le centre', () => {
    render(<LocationMap lat={48.85} lng={2.35} label="Cabinet du Parc" />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', JSON.stringify([48.85, 2.35]))
  })

  it('affiche le label fourni dans la popup', () => {
    render(<LocationMap lat={48.85} lng={2.35} label="Cabinet du Parc" />)
    expect(screen.getByTestId('popup')).toHaveTextContent('Cabinet du Parc')
  })
})
