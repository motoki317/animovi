'use client'

/**
 * ErrorBoundary - Catches React errors and displays fallback UI.
 * ErrorDisplay - Reusable error display component.
 */

import { Component, type ReactNode } from 'react'
import './error-boundary.css'

export type ErrorSeverity = 'error' | 'warning' | 'info'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isDevelopment = process.env.NODE_ENV === 'development'

      return (
        <div data-testid="error-boundary" className="error-boundary">
          <div className="error-boundary__content">
            <span className="error-boundary__icon">⚠️</span>
            <h2>Something went wrong</h2>
            <p>
              We're sorry, but something unexpected happened. Please try again.
            </p>

            {isDevelopment && this.state.error && (
              <pre className="error-boundary__details">
                {this.state.error.message}
              </pre>
            )}

            <button
              className="error-boundary__retry"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional error display component for non-boundary errors
export interface ErrorDisplayProps {
  title: string
  message: string
  severity?: ErrorSeverity
  onRetry?: () => void
}

export function ErrorDisplay({
  title,
  message,
  severity = 'error',
  onRetry,
}: ErrorDisplayProps) {
  const icons: Record<ErrorSeverity, string> = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  }

  return (
    <div
      data-testid="error-display"
      className={`error-display error-display--${severity}`}
    >
      <span data-testid="error-icon" className="error-display__icon">
        {icons[severity]}
      </span>
      <h3 className="error-display__title">{title}</h3>
      <p className="error-display__message">{message}</p>
      {onRetry && (
        <button className="error-display__retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
