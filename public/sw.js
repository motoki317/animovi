// Network-first for every GET. The cache is only an offline fallback: a
// cache-first version kept serving stale chunks across rebuilds (2b6c359).
//
// A new CACHE_NAME evicts every entry, because the activate handler deletes
// each cache with another name. Nothing else evicts entries, so each deploy
// adds its hashed chunks to the cache.
const CACHE_NAME = 'animovi-v2'

const PRECACHE_ASSETS = ['/']

// Cache.put() rejects a 206 partial response, which a media Range request gets.
function isCacheable(response) {
  return response.status === 200
}

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
  // Cache.put() rejects non-GET requests, so the browser handles them directly.
  if (event.request.method !== 'GET') return

  // The app has one page. Each online navigation replaces the offline shell,
  // so the shell matches the chunks that this visit caches.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isCacheable(response)) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone))
          }
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Cross-origin responses, such as the MediaPipe WASM and models, stay out of
  // the cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          isCacheable(response) &&
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
          return Response.error()
        })
      )
  )
})
