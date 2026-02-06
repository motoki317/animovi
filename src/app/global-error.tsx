'use client'

/**
 * Next.js global error page.
 * Catches errors in the root layout itself. Must include its own <html> and <body>.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
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
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Application Error</h1>
          <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>
            A critical error occurred. Please reload the page.
          </p>
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
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
