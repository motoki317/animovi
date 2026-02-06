/**
 * Browser feature detection for required APIs.
 * WebGL2 and Camera API are required; Service Worker is optional (PWA only).
 */

export interface BrowserSupport {
  webgl2: boolean
  mediaDevices: boolean
  serviceWorker: boolean
  /** True if all required features are available */
  supported: boolean
  /** List of missing required features */
  missing: string[]
}

export function checkBrowserSupport(): BrowserSupport {
  const webgl2 = checkWebGL2()
  const mediaDevices = checkMediaDevices()
  const serviceWorker = 'serviceWorker' in navigator

  const missing: string[] = []
  if (!webgl2) missing.push('WebGL2')
  if (!mediaDevices) missing.push('Camera API')

  return {
    webgl2,
    mediaDevices,
    serviceWorker,
    supported: missing.length === 0,
    missing,
  }
}

function checkWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

function checkMediaDevices(): boolean {
  return !!(navigator.mediaDevices?.getUserMedia)
}
