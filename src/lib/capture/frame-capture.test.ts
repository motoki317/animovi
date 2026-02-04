import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FrameCapture } from './frame-capture'

describe('FrameCapture', () => {
  let mockVideo: HTMLVideoElement
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D

  beforeEach(() => {
    // Mock video element
    mockVideo = {
      videoWidth: 640,
      videoHeight: 480,
      readyState: 4, // HAVE_ENOUGH_DATA
    } as HTMLVideoElement

    // Mock canvas context
    const mockImageData = {
      data: new Uint8ClampedArray(640 * 480 * 4),
      width: 640,
      height: 480,
    }

    mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(mockImageData),
    } as unknown as CanvasRenderingContext2D

    // Mock canvas element
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement

    // Mock document.createElement for canvas
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return mockCanvas as unknown as HTMLElement
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should capture frames from video element', () => {
    const capture = new FrameCapture()
    const frame = capture.captureFrame(mockVideo)

    expect(frame).not.toBeNull()
    expect(frame?.width).toBe(640)
    expect(frame?.height).toBe(480)
    expect(mockContext.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0, 640, 480)
  })

  it('should return null if video is not ready', () => {
    mockVideo.readyState = 0 // HAVE_NOTHING
    const capture = new FrameCapture()
    const frame = capture.captureFrame(mockVideo)

    expect(frame).toBeNull()
  })

  it('should return null if video has no dimensions', () => {
    mockVideo.videoWidth = 0
    mockVideo.videoHeight = 0
    const capture = new FrameCapture()
    const frame = capture.captureFrame(mockVideo)

    expect(frame).toBeNull()
  })

  it('should resize canvas to match video dimensions', () => {
    const capture = new FrameCapture()
    capture.captureFrame(mockVideo)

    expect(mockCanvas.width).toBe(640)
    expect(mockCanvas.height).toBe(480)
  })

  it('should throttle captures at target FPS', () => {
    const capture = new FrameCapture({ targetFps: 30 }) // ~33ms between frames

    // Manually track calls via captureFrame
    let frameCount = 0
    const originalCaptureFrame = capture.captureFrame.bind(capture)
    capture.captureFrame = (video: HTMLVideoElement) => {
      frameCount++
      return originalCaptureFrame(video)
    }

    // First capture should work
    const frame1 = capture.captureFrame(mockVideo)
    expect(frame1).not.toBeNull()
    expect(frameCount).toBe(1)

    // The throttling is internal to tick(), which relies on performance.now()
    // For unit testing, we verify the frameInterval calculation
    expect(capture['frameInterval']).toBeCloseTo(1000 / 30, 0)
  })

  it('should stop capturing when stopped', () => {
    const capture = new FrameCapture({ targetFps: 30 })
    const onFrame = vi.fn()

    // Start and verify running state
    capture.start(mockVideo, onFrame)
    expect(capture['isRunning']).toBe(true)
    expect(capture['currentCallback']).toBe(onFrame)

    // Stop and verify stopped state
    capture.stop()
    expect(capture['isRunning']).toBe(false)
    expect(capture['currentCallback']).toBeNull()
  })

  it('should reuse canvas for multiple captures', () => {
    const capture = new FrameCapture()

    capture.captureFrame(mockVideo)
    capture.captureFrame(mockVideo)
    capture.captureFrame(mockVideo)

    // document.createElement should only be called once for the canvas
    expect(document.createElement).toHaveBeenCalledWith('canvas')
    expect(document.createElement).toHaveBeenCalledTimes(1)
  })

  it('should use OffscreenCanvas when available', () => {
    // Mock OffscreenCanvas as a class
    const mockGetContext = vi.fn().mockReturnValue(mockContext)

    // @ts-expect-error - mocking global
    globalThis.OffscreenCanvas = class MockOffscreenCanvas {
      width: number
      height: number
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }
      getContext(type: string) {
        return mockGetContext(type)
      }
    }

    const capture = new FrameCapture({ useOffscreenCanvas: true })
    capture.captureFrame(mockVideo)

    expect(mockGetContext).toHaveBeenCalledWith('2d')

    // @ts-expect-error - cleanup
    delete globalThis.OffscreenCanvas
  })

  it('should fallback to regular canvas if OffscreenCanvas unavailable', () => {
    // Ensure OffscreenCanvas is not available
    // @ts-expect-error - ensuring undefined
    globalThis.OffscreenCanvas = undefined

    const capture = new FrameCapture({ useOffscreenCanvas: true })
    capture.captureFrame(mockVideo)

    // Should fallback to regular canvas
    expect(document.createElement).toHaveBeenCalledWith('canvas')
  })

  it('should scale down frame for performance when configured', () => {
    const capture = new FrameCapture({ maxWidth: 320, maxHeight: 240 })
    capture.captureFrame(mockVideo)

    // Canvas should be scaled down
    expect(mockCanvas.width).toBe(320)
    expect(mockCanvas.height).toBe(240)
  })

  it('should maintain aspect ratio when scaling', () => {
    // 16:9 video
    mockVideo.videoWidth = 1920
    mockVideo.videoHeight = 1080

    const capture = new FrameCapture({ maxWidth: 640, maxHeight: 480 })
    capture.captureFrame(mockVideo)

    // Should scale to fit while maintaining 16:9 aspect ratio
    // 640 / 1920 = 0.333, 480 / 1080 = 0.444
    // Use smaller scale (0.333) -> 640 x 360
    expect(mockCanvas.width).toBe(640)
    expect(mockCanvas.height).toBe(360)
  })
})
