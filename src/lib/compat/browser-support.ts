export interface BrowserSupport {
  webgl2: boolean
  mediaDevices: boolean
  serviceWorker: boolean
  /** True when WebGL2 and getUserMedia are both present. */
  supported: boolean
  /** Display names of the missing required features. */
  missing: string[]
}

/** A service worker only enables the PWA, so `supported` ignores it. */
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
