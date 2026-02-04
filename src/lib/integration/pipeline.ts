/**
 * TrackingPipeline - Orchestrates the full tracking to animation pipeline.
 * Connects tracking results to VRM animation with performance monitoring.
 */

import type { VRM } from '@pixiv/three-vrm'
import type { HolisticResult } from '../solver/holistic-solver'
import { TrackingBridge, TrackingBridgeOptions } from '../vrm/tracking-bridge'
import { PerformanceMonitor, PerformanceMetrics } from '../perf/monitor'

export interface PipelineOptions {
  /** VRM model to animate */
  vrm: VRM
  /** Enable face tracking (default: true) */
  faceTracking?: boolean
  /** Enable pose tracking (default: true) */
  poseTracking?: boolean
  /** Enable hand tracking (default: true) */
  handTracking?: boolean
  /** Smoothing factor 0-1 (default: 0.5) */
  smoothing?: number
}

export class TrackingPipeline {
  private bridge: TrackingBridge
  private monitor: PerformanceMonitor
  private running: boolean = true
  private disposed: boolean = false

  constructor(options: PipelineOptions) {
    const bridgeOptions: TrackingBridgeOptions = {
      faceTracking: options.faceTracking ?? true,
      poseTracking: options.poseTracking ?? true,
      handTracking: options.handTracking ?? true,
      smoothing: options.smoothing ?? 0.5,
    }

    this.bridge = new TrackingBridge(options.vrm, bridgeOptions)
    this.monitor = new PerformanceMonitor()
  }

  /**
   * Process a single tracking frame and update the VRM
   */
  processFrame(results: HolisticResult): void {
    if (this.disposed) {
      return
    }

    this.monitor.startFrame()

    try {
      this.bridge.update(results)
    } catch {
      // Gracefully handle errors during frame processing
    }

    this.monitor.endFrame()
  }

  /**
   * Update pipeline options dynamically
   */
  updateOptions(options: Partial<PipelineOptions>): void {
    const bridgeOptions: Partial<TrackingBridgeOptions> = {}

    if (options.faceTracking !== undefined) {
      bridgeOptions.faceTracking = options.faceTracking
    }
    if (options.poseTracking !== undefined) {
      bridgeOptions.poseTracking = options.poseTracking
    }
    if (options.handTracking !== undefined) {
      bridgeOptions.handTracking = options.handTracking
    }
    if (options.smoothing !== undefined) {
      bridgeOptions.smoothing = options.smoothing
    }

    this.bridge.setOptions(bridgeOptions)
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.monitor.getMetrics()
  }

  /**
   * Register a callback for performance warnings
   */
  onPerformanceWarning(
    listener: (warning: { type: string; frameTime?: number }) => void
  ): () => void {
    return this.monitor.onPerformanceWarning(listener)
  }

  /**
   * Check if the pipeline is running
   */
  isRunning(): boolean {
    return this.running && !this.disposed
  }

  /**
   * Dispose the pipeline and release resources
   */
  dispose(): void {
    this.running = false
    this.disposed = true
    this.bridge.dispose()
    this.monitor.reset()
  }
}
