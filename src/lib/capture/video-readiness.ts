/**
 * Video readiness utilities for tracking
 *
 * These utilities help determine when a video element has sufficient data
 * for MediaPipe tracking to work correctly.
 */

/**
 * Checks if a video element is ready for frame processing.
 *
 * Video readyState values:
 * - 0 HAVE_NOTHING: No information about the media
 * - 1 HAVE_METADATA: Enough info to get duration, dimensions
 * - 2 HAVE_CURRENT_DATA: Data for current playback position
 * - 3 HAVE_FUTURE_DATA: Data for current and some future
 * - 4 HAVE_ENOUGH_DATA: Enough data to play without buffering
 *
 * For tracking, we need at least HAVE_CURRENT_DATA (2) and valid dimensions.
 */
export function isVideoReady(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 0
}

export interface WaitForVideoReadyOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number
}

/**
 * Returns a promise that resolves when the video is ready for processing.
 * Listens for loadeddata and canplay events.
 *
 * @throws Error if timeout is reached before video becomes ready
 */
export function waitForVideoReady(
  video: HTMLVideoElement,
  options: WaitForVideoReadyOptions = {}
): Promise<void> {
  const { timeout = 10000 } = options

  return new Promise((resolve, reject) => {
    // Check if already ready
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
