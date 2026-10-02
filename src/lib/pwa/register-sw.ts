/**
 * Registers /sw.js in production only. In development it unregisters every
 * registration for this origin, because a worker kept from an earlier dev
 * session served stale chunks. Returns null in development, without service
 * worker support, and when a call fails.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
      return null
    }

    const registration = await navigator.serviceWorker.register('/sw.js')
    return registration
  } catch {
    return null
  }
}
