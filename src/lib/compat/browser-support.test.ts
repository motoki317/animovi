import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkBrowserSupport } from './browser-support'

describe('checkBrowserSupport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should detect full support when all APIs are available', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn() },
      serviceWorker: {},
    })

    const mockCanvas = {
      getContext: vi.fn().mockReturnValue({}),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement)

    const support = checkBrowserSupport()
    expect(support.webgl2).toBe(true)
    expect(support.mediaDevices).toBe(true)
    expect(support.serviceWorker).toBe(true)
    expect(support.supported).toBe(true)
  })

  it('should detect missing WebGL2', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn() },
      serviceWorker: {},
    })

    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(null),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement)

    const support = checkBrowserSupport()
    expect(support.webgl2).toBe(false)
    expect(support.supported).toBe(false)
    expect(support.missing).toContain('WebGL2')
  })

  it('should detect missing MediaDevices', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: undefined,
      serviceWorker: {},
    })

    const mockCanvas = { getContext: vi.fn().mockReturnValue({}) }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement)

    const support = checkBrowserSupport()
    expect(support.mediaDevices).toBe(false)
    expect(support.supported).toBe(false)
    expect(support.missing).toContain('Camera API')
  })

  it('should still be usable without Service Worker (non-critical)', () => {
    const nav = { mediaDevices: { getUserMedia: vi.fn() } }
    vi.stubGlobal('navigator', nav)

    const mockCanvas = { getContext: vi.fn().mockReturnValue({}) }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement)

    const support = checkBrowserSupport()
    expect(support.serviceWorker).toBe(false)
    expect(support.supported).toBe(true)
  })
})
