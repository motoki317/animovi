/**
 * PerformanceMonitor - Tracks frame timing and performance metrics.
 * Emits warnings when performance degrades below acceptable thresholds.
 */

export interface PerformanceMetrics {
  /** Time taken for the last frame in milliseconds */
  lastFrameTime: number
  /** Rolling average frames per second */
  averageFps: number
  /** Total number of frames processed */
  frameCount: number
  /** Number of frames that exceeded the target frame time */
  droppedFrames: number
}

export interface PerformanceWarning {
  type: 'slow-frame' | 'degraded-performance'
  frameTime?: number
  averageFps?: number
}

type WarningListener = (warning: PerformanceWarning) => void

/** Target frame time for 60fps */
const TARGET_FRAME_TIME = 16.67

/** Number of frames to use for rolling average */
const ROLLING_WINDOW_SIZE = 60

export class PerformanceMonitor {
  private frameStartTime: number = 0
  private frameTimes: number[] = []
  private frameCount: number = 0
  private droppedFrames: number = 0
  private lastFrameTime: number = 0
  private warningListeners: Set<WarningListener> = new Set()

  /**
   * Call at the start of each frame
   */
  startFrame(): void {
    this.frameStartTime = performance.now()
  }

  /**
   * Call at the end of each frame to record timing
   */
  endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime
    this.lastFrameTime = frameTime
    this.frameCount++

    // Add to rolling window
    this.frameTimes.push(frameTime)
    if (this.frameTimes.length > ROLLING_WINDOW_SIZE) {
      this.frameTimes.shift()
    }

    // Check for slow frame
    if (frameTime > TARGET_FRAME_TIME) {
      this.droppedFrames++
      this.emitWarning({
        type: 'slow-frame',
        frameTime,
      })
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const averageFps = this.calculateAverageFps()

    return {
      lastFrameTime: this.lastFrameTime,
      averageFps,
      frameCount: this.frameCount,
      droppedFrames: this.droppedFrames,
    }
  }

  /**
   * Register a callback for performance warnings
   * @returns Unsubscribe function
   */
  onPerformanceWarning(listener: WarningListener): () => void {
    this.warningListeners.add(listener)
    return () => {
      this.warningListeners.delete(listener)
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameStartTime = 0
    this.frameTimes = []
    this.frameCount = 0
    this.droppedFrames = 0
    this.lastFrameTime = 0
  }

  private calculateAverageFps(): number {
    if (this.frameTimes.length === 0) {
      return 0
    }

    const averageFrameTime =
      this.frameTimes.reduce((sum, time) => sum + time, 0) /
      this.frameTimes.length

    if (averageFrameTime === 0) {
      return 0
    }

    return 1000 / averageFrameTime
  }

  private emitWarning(warning: PerformanceWarning): void {
    for (const listener of this.warningListeners) {
      listener(warning)
    }
  }
}
