/**
 * Global error handler for unhandled errors and promise rejections.
 * Logs to console in development; could be extended with external reporting.
 */

export type ErrorHandler = (event: { type: string; message: string; error?: Error }) => void

let installed = false
let handler: ErrorHandler | null = null

export function installGlobalErrorHandler(onError?: ErrorHandler): () => void {
  if (installed) return () => {}

  handler = onError ?? null

  const handleError = (event: ErrorEvent) => {
    const info = {
      type: 'unhandled_error',
      message: event.message || 'Unknown error',
      error: event.error instanceof Error ? event.error : undefined,
    }
    console.error('[GlobalErrorHandler]', info.message, event.error)
    handler?.(info)
  }

  const handleRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : undefined
    const message = error?.message ?? String(event.reason ?? 'Unhandled promise rejection')
    const info = {
      type: 'unhandled_rejection',
      message,
      error,
    }
    console.error('[GlobalErrorHandler]', info.message, event.reason)
    handler?.(info)
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)
  installed = true

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
    installed = false
    handler = null
  }
}
