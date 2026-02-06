'use client'

/**
 * Next.js App Router error page.
 * Catches errors in route segments and displays a recovery UI.
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <main
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
        <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>
          An unexpected error occurred. Please try again.
        </p>
        {isDevelopment && (
          <pre
            style={{
              textAlign: 'left',
              background: '#2a2a3e',
              padding: '1rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              overflow: 'auto',
              marginBottom: '1.5rem',
              color: '#f87171',
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1.5rem',
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Try Again
        </button>
      </div>
    </main>
  )
}
