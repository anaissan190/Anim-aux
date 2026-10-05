import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import UpdateBanner from './UpdateBanner'

function mockServiceWorker(controller: object | null) {
  const target = new EventTarget() as any
  target.controller = controller
  target.getRegistration = () => Promise.resolve(undefined)
  Object.defineProperty(navigator, 'serviceWorker', { value: target, configurable: true })
  return target
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('UpdateBanner', () => {
  it("n'affiche rien au chargement", () => {
    mockServiceWorker({})
    render(<UpdateBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("propose de recharger quand un nouveau service worker prend la main sur une page déjà contrôlée", () => {
    const sw = mockServiceWorker({})
    render(<UpdateBanner />)
    act(() => { sw.dispatchEvent(new Event('controllerchange')) })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Recharger')).toBeTruthy()
  })

  it("n'affiche rien lors de la toute première installation (aucun contrôleur avant)", () => {
    const sw = mockServiceWorker(null)
    render(<UpdateBanner />)
    act(() => { sw.dispatchEvent(new Event('controllerchange')) })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
