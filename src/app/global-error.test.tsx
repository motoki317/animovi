import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from './global-error'

describe('GlobalError page', () => {
  it('should display critical error message and reload button', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('Critical')} reset={reset} />)

    expect(screen.getByText('Application Error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('should call reset when Reload is clicked', () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error('Critical')} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
