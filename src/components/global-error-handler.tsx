'use client'

import { useEffect } from 'react'
import { installGlobalErrorHandler } from '../lib/error/global-handler'

/** Installs the window error and unhandledrejection handlers while mounted. */
export function GlobalErrorHandler() {
  useEffect(() => {
    return installGlobalErrorHandler()
  }, [])

  return null
}
