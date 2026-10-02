import { describe, it, expect, vi, afterEach } from 'vitest'
import { registerServiceWorker } from './register-sw'

function stubServiceWorker(container: Partial<ServiceWorkerContainer> | undefined) {
  if (container === undefined) {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    return
  }
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true })
}

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    stubServiceWorker(undefined)
  })

  it('returns null without service worker support', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    stubServiceWorker(undefined)

    expect('serviceWorker' in navigator).toBe(false)
    expect(await registerServiceWorker()).toBeNull()
  })

  describe('in production', () => {
    it('registers /sw.js', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const registration = { scope: '/' } as ServiceWorkerRegistration
      const register = vi.fn().mockResolvedValue(registration)
      stubServiceWorker({ register })

      expect(await registerServiceWorker()).toBe(registration)
      expect(register).toHaveBeenCalledWith('/sw.js')
    })

    it('returns null when registration fails', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      stubServiceWorker({ register: vi.fn().mockRejectedValue(new Error('failed')) })

      expect(await registerServiceWorker()).toBeNull()
    })
  })

  describe('in development', () => {
    it('unregisters existing service workers and does not register', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const unregisterA = vi.fn().mockResolvedValue(true)
      const unregisterB = vi.fn().mockResolvedValue(true)
      const register = vi.fn()
      stubServiceWorker({
        register,
        getRegistrations: vi.fn().mockResolvedValue([
          { unregister: unregisterA },
          { unregister: unregisterB },
        ]),
      })

      expect(await registerServiceWorker()).toBeNull()
      expect(unregisterA).toHaveBeenCalled()
      expect(unregisterB).toHaveBeenCalled()
      expect(register).not.toHaveBeenCalled()
    })

    it('returns null when unregistering fails', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      stubServiceWorker({
        register: vi.fn(),
        getRegistrations: vi.fn().mockRejectedValue(new Error('SecurityError')),
      })

      expect(await registerServiceWorker()).toBeNull()
    })
  })
})
