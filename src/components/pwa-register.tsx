'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '../lib/pwa/register-sw'

export function PWARegister() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}
