/**
 * FrameCapture - Utility for capturing video frames as ImageData
 * Supports throttling, OffscreenCanvas, and performance-optimized scaling.
 */

export interface FrameCaptureOptions {
  /** Target frames per second for throttling (default: 30) */
  targetFps?: number
  /** Maximum width for captured frames (for performance) */
  maxWidth?: number
  /** Maximum height for captured frames (for performance) */
  maxHeight?: number
  /** Use OffscreenCanvas when available (default: false) */
  useOffscreenCanvas?: boolean
}

export type FrameCallback = (frame: ImageData) => void

export class FrameCapture {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null
  private context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
  private targetFps: number
  private maxWidth?: number
  private maxHeight?: number
  private useOffscreenCanvas: boolean

  private isRunning = false
  private lastCaptureTime = 0
  private frameInterval: number
  private currentCallback: FrameCallback | null = null
  private currentVideo: HTMLVideoElement | null = null

  constructor(options: FrameCaptureOptions = {}) {
    this.targetFps = options.targetFps ?? 30
    this.maxWidth = options.maxWidth
    this.maxHeight = options.maxHeight
    this.useOffscreenCanvas = options.useOffscreenCanvas ?? false
    this.frameInterval = 1000 / this.targetFps
  }

  /**
   * Capture a single frame from the video element
   */
  captureFrame(video: HTMLVideoElement): ImageData | null {
    // Check if video is ready
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return null
    }

    // Calculate target dimensions
    const { width, height } = this.calculateDimensions(
      video.videoWidth,
      video.videoHeight
    )

    // Initialize or resize canvas if needed
    this.ensureCanvas(width, height)

    if (!this.context) {
      return null
    }

    // Draw video frame to canvas
    this.context.drawImage(video, 0, 0, width, height)

    // Get image data
    return this.context.getImageData(0, 0, width, height)
  }

  /**
   * Start continuous frame capture at the configured FPS
   */
  start(video: HTMLVideoElement, onFrame: FrameCallback): void {
    this.isRunning = true
    this.currentCallback = onFrame
    this.currentVideo = video
    this.lastCaptureTime = 0

    // Capture first frame immediately
    this.tick()
  }

  /**
   * Stop continuous frame capture
   */
  stop(): void {
    this.isRunning = false
    this.currentCallback = null
    this.currentVideo = null
  }

  /**
   * Process a tick - call this from requestAnimationFrame or setInterval
   */
  tick(): void {
    if (!this.isRunning || !this.currentCallback || !this.currentVideo) {
      return
    }

    const now = performance.now()

    // Throttle based on target FPS
    if (now - this.lastCaptureTime < this.frameInterval) {
      return
    }

    const frame = this.captureFrame(this.currentVideo)
    if (frame) {
      this.lastCaptureTime = now
      this.currentCallback(frame)
    }
  }

  /**
   * Calculate target dimensions, maintaining aspect ratio
   */
  private calculateDimensions(
    sourceWidth: number,
    sourceHeight: number
  ): { width: number; height: number } {
    if (!this.maxWidth && !this.maxHeight) {
      return { width: sourceWidth, height: sourceHeight }
    }

    const maxW = this.maxWidth ?? Infinity
    const maxH = this.maxHeight ?? Infinity

    // Calculate scale factors
    const scaleX = maxW / sourceWidth
    const scaleY = maxH / sourceHeight

    // Use the smaller scale to maintain aspect ratio and fit within bounds
    const scale = Math.min(scaleX, scaleY, 1) // Don't scale up

    return {
      width: Math.round(sourceWidth * scale),
      height: Math.round(sourceHeight * scale),
    }
  }

  /**
   * Ensure canvas exists and has correct dimensions
   */
  private ensureCanvas(width: number, height: number): void {
    // Try to use OffscreenCanvas if requested and available
    if (this.useOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
      if (!this.canvas || this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas = new OffscreenCanvas(width, height)
        this.context = this.canvas.getContext('2d')
      }
      return
    }

    // Fall back to regular canvas
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
    }

    if (this.canvas.width !== width) {
      this.canvas.width = width
    }
    if (this.canvas.height !== height) {
      this.canvas.height = height
    }

    if (!this.context) {
      this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop()
    this.canvas = null
    this.context = null
  }
}
