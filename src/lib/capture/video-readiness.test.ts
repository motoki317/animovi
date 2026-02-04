/**
 * Tests for video readiness utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isVideoReady, waitForVideoReady } from './video-readiness'

describe('isVideoReady', () => {
  it('should return false when readyState < 2', () => {
    const video = {
      readyState: 1,
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement

    expect(isVideoReady(video)).toBe(false)
  })

  it('should return false when videoWidth is 0', () => {
    const video = {
      readyState: 4,
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement

    expect(isVideoReady(video)).toBe(false)
  })

  it('should return false when readyState is 0 (HAVE_NOTHING)', () => {
    const video = {
      readyState: 0,
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement

    expect(isVideoReady(video)).toBe(false)
  })

  it('should return true when readyState >= 2 and videoWidth > 0', () => {
    const video = {
      readyState: 2, // HAVE_CURRENT_DATA
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement

    expect(isVideoReady(video)).toBe(true)
  })

  it('should return true when readyState is 4 (HAVE_ENOUGH_DATA) and videoWidth > 0', () => {
    const video = {
      readyState: 4,
      videoWidth: 1920,
      videoHeight: 1080,
    } as HTMLVideoElement

    expect(isVideoReady(video)).toBe(true)
  })
})

describe('waitForVideoReady', () => {
  let video: HTMLVideoElement

  beforeEach(() => {
    video = document.createElement('video')
  })

  it('should resolve immediately if video is already ready', async () => {
    // Set up video as ready
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true })

    await expect(waitForVideoReady(video)).resolves.toBeUndefined()
  })

  it('should wait for loadeddata event when video is not ready', async () => {
    // Video starts not ready
    Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 0, writable: true, configurable: true })

    const promise = waitForVideoReady(video)

    // Simulate video becoming ready
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true })
    video.dispatchEvent(new Event('loadeddata'))

    await expect(promise).resolves.toBeUndefined()
  })

  it('should reject with timeout error after specified timeout', async () => {
    // Video never becomes ready
    Object.defineProperty(video, 'readyState', { value: 0, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true })

    await expect(waitForVideoReady(video, { timeout: 50 }))
      .rejects.toThrow('Video did not become ready within 50ms')
  })

  it('should clean up event listener after resolving', async () => {
    Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 0, writable: true, configurable: true })

    const removeListenerSpy = vi.spyOn(video, 'removeEventListener')

    const promise = waitForVideoReady(video)

    Object.defineProperty(video, 'readyState', { value: 4, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true })
    video.dispatchEvent(new Event('loadeddata'))

    await promise

    expect(removeListenerSpy).toHaveBeenCalledWith('loadeddata', expect.any(Function))
  })

  it('should clean up event listener after timeout', async () => {
    Object.defineProperty(video, 'readyState', { value: 0, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true })

    const removeListenerSpy = vi.spyOn(video, 'removeEventListener')

    try {
      await waitForVideoReady(video, { timeout: 50 })
    } catch {
      // Expected to throw
    }

    expect(removeListenerSpy).toHaveBeenCalledWith('loadeddata', expect.any(Function))
  })

  it('should resolve on canplay event as well', async () => {
    Object.defineProperty(video, 'readyState', { value: 0, writable: true, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 0, writable: true, configurable: true })

    const promise = waitForVideoReady(video)

    Object.defineProperty(video, 'readyState', { value: 3, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true })
    video.dispatchEvent(new Event('canplay'))

    await expect(promise).resolves.toBeUndefined()
  })
})
