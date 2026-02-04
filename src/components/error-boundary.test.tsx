import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, ErrorDisplay } from './error-boundary'

describe('ErrorBoundary', () => {
  // Suppress React error boundary console errors for cleaner test output
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  const ThrowError = ({ error }: { error?: Error }) => {
    if (error) {
      throw error
    }
    return <div>No error</div>
  }

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Content</div>
      </ErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('should display friendly error messages', () => {
    render(
      <ErrorBoundary>
        <ThrowError error={new Error('Test error message')} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('should offer retry action for recoverable errors', () => {
    const onReset = vi.fn()

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowError error={new Error('Recoverable error')} />
      </ErrorBoundary>
    )

    const retryButton = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(retryButton)

    expect(onReset).toHaveBeenCalled()
  })

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError error={new Error('Detailed error')} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/detailed error/i)).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should use custom fallback when provided', () => {
    const CustomFallback = () => <div data-testid="custom">Custom error</div>

    render(
      <ErrorBoundary fallback={<CustomFallback />}>
        <ThrowError error={new Error('Error')} />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('custom')).toBeInTheDocument()
  })
})

describe('ErrorDisplay', () => {
  it('should display error title and message', () => {
    render(<ErrorDisplay title="VRM Load Failed" message="Invalid file format" />)

    expect(screen.getByText('VRM Load Failed')).toBeInTheDocument()
    expect(screen.getByText('Invalid file format')).toBeInTheDocument()
  })

  it('should show retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorDisplay title="Error" message="Failed" onRetry={onRetry} />)

    const button = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(button)

    expect(onRetry).toHaveBeenCalled()
  })

  it('should apply different severity styles', () => {
    const { rerender } = render(
      <ErrorDisplay title="Error" message="Test" severity="error" />
    )

    expect(screen.getByTestId('error-display')).toHaveClass(
      'error-display--error'
    )

    rerender(<ErrorDisplay title="Warning" message="Test" severity="warning" />)

    expect(screen.getByTestId('error-display')).toHaveClass(
      'error-display--warning'
    )
  })

  it('should show icon based on severity', () => {
    render(<ErrorDisplay title="Error" message="Test" severity="error" />)

    expect(screen.getByTestId('error-icon')).toBeInTheDocument()
  })
})
