import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IntendedPlanPicker from './IntendedPlanPicker'

describe('IntendedPlanPicker', () => {
  it('propose les trois formules et précise que ce n\'est pas un achat', () => {
    render(<IntendedPlanPicker value={null} onChange={() => {}} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByText(/aucun paiement aujourd'hui/i)).toBeInTheDocument()
  })

  it('remonte la formule choisie', () => {
    const onChange = vi.fn()
    render(<IntendedPlanPicker value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Abonnement cabinet/ }))
    expect(onChange).toHaveBeenCalledWith('cabinet')
  })

  it('coche la formule courante et affiche une erreur', () => {
    render(<IntendedPlanPicker value="pro" onChange={() => {}} error="Obligatoire" />)
    expect(screen.getByRole('radio', { name: /39,90 €/ })).toBeChecked()
    expect(screen.getByText('Obligatoire')).toBeInTheDocument()
  })
})
