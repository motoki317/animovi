/**
 * PipelineProfiler - Tracks per-stage timing for the tracking and rendering pipeline.
 * Provides rolling averages, max values, and FPS tracking.
 */

export interface StageTiming {
  lastMs: number
  avgMs: number
  maxMs: number
}

export interface StageTimings {
  [stageName: string]: StageTiming
}

interface StageData {
  startTime: number | null
  samples: number[]
}

export class PipelineProfiler {
  private stages: Map<string, StageData> = new Map()
  private windowSize: number
  private frameTimes: number[] = []
  private lastFrameTime: number | null = null

  constructor(windowSize = 60) {
    this.windowSize = windowSize
  }

  /** Start timing a named stage */
  begin(stage: string): void {
    let data = this.stages.get(stage)
    if (!data) {
      data = { startTime: null, samples: [] }
      this.stages.set(stage, data)
    }
    data.startTime = performance.now()
  }

  /** End timing a named stage */
  end(stage: string): void {
    const data = this.stages.get(stage)
    if (!data || data.startTime === null) return

    const elapsed = performance.now() - data.startTime
    data.samples.push(elapsed)
    if (data.samples.length > this.windowSize) {
      data.samples.shift()
    }
    data.startTime = null
  }

  /** Get timing stats for all tracked stages */
  getTimings(): StageTimings {
    const result: StageTimings = {}
    for (const [name, data] of this.stages) {
      if (data.samples.length === 0) continue
      const lastMs = data.samples[data.samples.length - 1]
      const avgMs = data.samples.reduce((s, v) => s + v, 0) / data.samples.length
      let maxMs = 0
      for (const s of data.samples) {
        if (s > maxMs) maxMs = s
      }
      result[name] = { lastMs, avgMs, maxMs }
    }
    return result
  }

  /** Get total pipeline time (sum of last values for all stages) */
  getTotalMs(): number {
    let total = 0
    for (const data of this.stages.values()) {
      if (data.samples.length > 0) {
        total += data.samples[data.samples.length - 1]
      }
    }
    return total
  }

  /** Mark a frame boundary for FPS calculation */
  markFrame(): void {
    const now = performance.now()
    if (this.lastFrameTime !== null) {
      this.frameTimes.push(now - this.lastFrameTime)
      if (this.frameTimes.length > this.windowSize) {
        this.frameTimes.shift()
      }
    }
    this.lastFrameTime = now
  }

  /** Get current FPS based on frame marks */
  getFps(): number {
    if (this.frameTimes.length === 0) return 0
    const avg = this.frameTimes.reduce((s, v) => s + v, 0) / this.frameTimes.length
    return avg > 0 ? 1000 / avg : 0
  }

  /** Reset all data */
  reset(): void {
    this.stages.clear()
    this.frameTimes = []
    this.lastFrameTime = null
  }
}
