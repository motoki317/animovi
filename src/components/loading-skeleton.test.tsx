import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSkeleton } from './loading-skeleton'

describe('LoadingSkeleton', () => {
  it('should show skeleton while VRM loads', () => {
    render(<LoadingSkeleton type="vrm" />)

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('loading-skeleton')).toHaveClass(
      'loading-skeleton--vrm'
    )
  })

  it('should show camera permission prompt state', () => {
    render(<LoadingSkeleton type="camera-permission" />)

    expect(
      screen.getByText(/please allow camera access/i)
    ).toBeInTheDocument()
  })

  it('should display custom message', () => {
    render(<LoadingSkeleton message="Loading avatar..." />)

    expect(screen.getByText('Loading avatar...')).toBeInTheDocument()
  })

  it('should show pulse animation', () => {
    render(<LoadingSkeleton type="vrm" />)

    const skeleton = screen.getByTestId('loading-skeleton')
    expect(skeleton).toHaveClass('loading-skeleton--animated')
  })

  it('should support different sizes', () => {
    const { rerender } = render(<LoadingSkeleton size="small" />)

    expect(screen.getByTestId('loading-skeleton')).toHaveClass(
      'loading-skeleton--small'
    )

    rerender(<LoadingSkeleton size="large" />)

    expect(screen.getByTestId('loading-skeleton')).toHaveClass(
      'loading-skeleton--large'
    )
  })

  it('should support full-screen mode', () => {
    render(<LoadingSkeleton fullScreen />)

    expect(screen.getByTestId('loading-skeleton')).toHaveClass(
      'loading-skeleton--fullscreen'
    )
  })
})
