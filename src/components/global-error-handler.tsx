'use client'

import { useEffect } from 'react'
import { installGlobalErrorHandler } from '../lib/error/global-handler'

/**
 * Client component that installs global error/rejection handlers on mount.
 * Place in layout.tsx to catch unhandled errors app-wide.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    return installGlobalErrorHandler()
  }, [])

  return null
}
