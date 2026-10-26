import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const state = { launch: undefined as any, intended: undefined as any }
vi.mock('@/hooks/useData', () => ({
  useLaunchSettings: () => ({ data: state.launch }),
  useMyIntendedPlan: () => ({ data: state.intended }),
}))

import PrelaunchPlanBanner from './PrelaunchPlanBanner'

const renderBanner = () => render(<MemoryRouter><PrelaunchPlanBanner /></MemoryRouter>)

beforeEach(() => {
  state.launch = { phase: 'prelaunch', publicLaunchDate: '2027-01-15' }
  state.intended = null
})

describe('PrelaunchPlanBanner', () => {
  it("invite à choisir une formule pendant le pré-lancement quand aucune n'est choisie", () => {
    renderBanner()
    expect(screen.getByTestId('prelaunch-plan-banner')).toHaveTextContent(/15 janvier/)
    expect(screen.getByRole('link', { name: 'Choisir ma formule' })).toHaveAttribute('href', '/abonnement')
  })

  it('disparaît dès que la formule est choisie', () => {
    state.intended = 'pro'
    renderBanner()
    expect(screen.queryByTestId('prelaunch-plan-banner')).not.toBeInTheDocument()
  })

  it("n'apparaît pas quand le site est ouvert", () => {
    state.launch = { phase: 'open', publicLaunchDate: null }
    renderBanner()
    expect(screen.queryByTestId('prelaunch-plan-banner')).not.toBeInTheDocument()
  })

  it('reste caché tant que la lecture est en cours', () => {
    state.intended = undefined
    renderBanner()
    expect(screen.queryByTestId('prelaunch-plan-banner')).not.toBeInTheDocument()
  })
})
