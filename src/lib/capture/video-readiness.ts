/** readyState 2 is HAVE_CURRENT_DATA, the first state with a frame at the current position. */
export function isVideoReady(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 0
}

export interface WaitForVideoReadyOptions {
  /** Milliseconds. Default 10000. */
  timeout?: number
}

/**
 * Resolves once isVideoReady() holds. It checks again on each `loadeddata` and
 * `canplay` event, and rejects after `timeout` ms.
 */
export function waitForVideoReady(
  video: HTMLVideoElement,
  options: WaitForVideoReadyOptions = {}
): Promise<void> {
  const { timeout = 10000 } = options

  return new Promise((resolve, reject) => {
    if (isVideoReady(video)) {
      resolve()
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('canplay', onReady)
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }

    const onReady = () => {
      if (isVideoReady(video)) {
        cleanup()
        resolve()
      }
    }

    video.addEventListener('loadeddata', onReady)
    video.addEventListener('canplay', onReady)

    timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error(`Video did not become ready within ${timeout}ms`))
    }, timeout)
  })
}
