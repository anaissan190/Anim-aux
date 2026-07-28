import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import Turnstile from './Turnstile'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'

beforeEach(() => {
  document.head.querySelectorAll('script').forEach(s => s.remove())
  delete window.turnstile
  delete window.onTurnstileLoad
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Turnstile', () => {
  it('ne rend rien sans clé de site configurée', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    const { container } = render(<Turnstile onVerify={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('injecte le script Cloudflare une seule fois si window.turnstile n\'est pas encore chargé', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')
    render(<Turnstile onVerify={vi.fn()} />)
    const scripts = document.head.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)
    expect(scripts).toHaveLength(1)
  })

  it('n\'injecte pas de second script si un premier est déjà présent', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')
    render(<Turnstile onVerify={vi.fn()} />)
    render(<Turnstile onVerify={vi.fn()} />)
    const scripts = document.head.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)
    expect(scripts).toHaveLength(1)
  })

  it('appelle directement window.turnstile.render si déjà chargé, avec la bonne sitekey', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')
    const renderWidget = vi.fn<NonNullable<Window['turnstile']>['render']>(() => 'widget-1')
    window.turnstile = { render: renderWidget, remove: vi.fn() }

    const onVerify = vi.fn()
    render(<Turnstile onVerify={onVerify} />)

    expect(renderWidget).toHaveBeenCalledTimes(1)
    const [, options] = renderWidget.mock.calls[0]
    expect(options.sitekey).toBe('test-site-key')
    expect(options.callback).toBe(onVerify)
  })

  it('retire le widget au démontage si le script était déjà chargé', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')
    const removeWidget = vi.fn()
    window.turnstile = { render: vi.fn(() => 'widget-1'), remove: removeWidget }

    const { unmount } = render(<Turnstile onVerify={vi.fn()} />)
    unmount()

    expect(removeWidget).toHaveBeenCalledWith('widget-1')
  })
})
