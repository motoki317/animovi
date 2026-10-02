import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorPage from './error'

describe('Error page', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should display error message and try again button', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('Test error')} reset={reset} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('should call reset when Try Again is clicked', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('Test error')} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('should not show error details in production mode', () => {
    vi.stubEnv('NODE_ENV', 'production')
    render(<ErrorPage error={new Error('Secret error info')} reset={vi.fn()} />)

    expect(screen.queryByText('Secret error info')).not.toBeInTheDocument()
  })

  it('shows error details in development mode', () => {
    vi.stubEnv('NODE_ENV', 'development')
    render(<ErrorPage error={new Error('Secret error info')} reset={vi.fn()} />)

    expect(screen.getByText('Secret error info')).toBeInTheDocument()
  })
})
