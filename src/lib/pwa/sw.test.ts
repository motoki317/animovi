import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ORIGIN = 'http://localhost:3000'
const SW_SOURCE = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')

type FakeRequest = { url: string; method: string; mode: string }
type FetchEvent = { request: FakeRequest; respondWith: (r: Promise<Response>) => void }

// Runs public/sw.js against fakes of the service worker globals that it reads.
function loadServiceWorker(network: () => Promise<Response>) {
  let onFetch: ((event: FetchEvent) => void) | undefined
  const cache = { addAll: vi.fn(async () => {}), put: vi.fn(async () => {}) }
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async (): Promise<Response | undefined> => undefined),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  }
  const self = {
    location: { origin: ORIGIN },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener: (type: string, listener: (event: FetchEvent) => void) => {
      if (type === 'fetch') onFetch = listener
    },
  }
  new Function('self', 'caches', 'fetch', SW_SOURCE)(self, caches, network)

  async function dispatchFetch(request: FakeRequest): Promise<Response> {
    let response: Promise<Response> | undefined
    onFetch!({ request, respondWith: (r) => { response = r } })
    const result = await response!
    // The worker writes to the cache without awaiting it.
    await new Promise((resolve) => setTimeout(resolve, 0))
    return result
  }

  return { cache, caches, dispatchFetch }
}

const asset = (path: string): FakeRequest => ({ url: ORIGIN + path, method: 'GET', mode: 'cors' })
const navigation = (path: string): FakeRequest => ({ url: ORIGIN + path, method: 'GET', mode: 'navigate' })

describe('service worker', () => {
  it('caches a full same-origin response', async () => {
    const { cache, dispatchFetch } = loadServiceWorker(async () => new Response('js'))
    const request = asset('/_next/static/chunks/a.js')

    await dispatchFetch(request)

    expect(cache.put).toHaveBeenCalledWith(request, expect.any(Response))
  })

  it('does not cache a 206 partial response, which Cache.put() rejects', async () => {
    const { cache, dispatchFetch } = loadServiceWorker(
      async () => new Response('part', { status: 206 }),
    )

    const response = await dispatchFetch(asset('/__perf_footage.mp4'))

    expect(response.status).toBe(206)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('stores each online navigation as the offline shell', async () => {
    const { cache, dispatchFetch } = loadServiceWorker(async () => new Response('<html>v2</html>'))

    await dispatchFetch(navigation('/?footage=1'))

    expect(cache.put).toHaveBeenCalledWith('/', expect.any(Response))
  })

  it('serves the cached shell for an offline navigation', async () => {
    const { caches, dispatchFetch } = loadServiceWorker(async () => {
      throw new TypeError('Failed to fetch')
    })
    const shell = new Response('<html>shell</html>')
    caches.match.mockResolvedValue(shell)

    expect(await dispatchFetch(navigation('/'))).toBe(shell)
    expect(caches.match).toHaveBeenCalledWith('/')
  })
})
