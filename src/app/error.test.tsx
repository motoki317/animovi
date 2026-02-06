import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Error from './error'

describe('Error page', () => {
  it('should display error message and try again button', () => {
    const reset = vi.fn()
    render(<Error error={new Error('Test error')} reset={reset} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('should call reset when Try Again is clicked', () => {
    const reset = vi.fn()
    render(<Error error={new Error('Test error')} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('should not show error details in production mode', () => {
    // In test environment NODE_ENV is 'test', not 'development',
    // so error details should be hidden (same as production)
    const reset = vi.fn()
    render(<Error error={new Error('Secret error info')} reset={reset} />)

    expect(screen.queryByText('Secret error info')).not.toBeInTheDocument()
  })
})
