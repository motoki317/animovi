import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerServiceWorker } from './register-sw'

describe('registerServiceWorker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return null when serviceWorker not supported', async () => {
    // Remove serviceWorker from navigator
    const original = navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const result = await registerServiceWorker()
    expect(result).toBeNull()

    Object.defineProperty(navigator, 'serviceWorker', {
      value: original,
      writable: true,
      configurable: true,
    })
  })

  it('should register service worker at /sw.js', async () => {
    const mockRegistration = { scope: '/' }
    const mockRegister = vi.fn().mockResolvedValue(mockRegistration)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    })

    const result = await registerServiceWorker()

    expect(mockRegister).toHaveBeenCalledWith('/sw.js')
    expect(result).toBe(mockRegistration)
  })

  it('should return null when registration fails', async () => {
    const mockRegister = vi.fn().mockRejectedValue(new Error('failed'))
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    })

    const result = await registerServiceWorker()
    expect(result).toBeNull()
  })
})
