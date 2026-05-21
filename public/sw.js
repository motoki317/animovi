// Service Worker for Animovi PWA
//
// Strategy: network-first for everything online; the cache is purely an
// offline fallback. We previously used cache-first for static assets, but
// that silently pinned old code (e.g. the MediaPipe tracking worker) across
// rebuilds — when a chunk URL was already cached, the SW kept serving the
// stale version even after a fresh `npm run build`. Network-first guarantees
// the user always loads the latest deploy when online, at the cost of one
// network round-trip per asset.
//
// Bump CACHE_NAME whenever you change this strategy; the activate handler
// nukes any caches that don't match, evicting old stale chunks.
const CACHE_NAME = 'animovi-v2'

const PRECACHE_ASSETS = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Skip non-GET — these aren't cacheable and routing them through the SW
  // just adds latency (and they'd error if we tried to cache them).
  if (event.request.method !== 'GET') return

  // Navigation: network-first, fall back to the cached shell only when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    )
    return
  }

  // Everything else: network-first with cache fallback. Successful responses
  // get written back to cache so we have an offline copy for next time.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached
          // No cache, no network — let the request fail naturally.
          return Response.error()
        })
      )
  )
})
