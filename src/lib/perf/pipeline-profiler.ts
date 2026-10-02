/**
 * Per-stage timings in milliseconds over the last `windowSize` samples, and FPS
 * from the intervals between markFrame() calls.
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

  begin(stage: string): void {
    let data = this.stages.get(stage)
    if (!data) {
      data = { startTime: null, samples: [] }
      this.stages.set(stage, data)
    }
    data.startTime = performance.now()
  }

  /** Does nothing when no begin() is open for the stage. */
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

  /** Omits stages that have no samples. */
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

  /** Sum of the last sample of every stage. */
  getTotalMs(): number {
    let total = 0
    for (const data of this.stages.values()) {
      if (data.samples.length > 0) {
        total += data.samples[data.samples.length - 1]
      }
    }
    return total
  }

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

  /** Returns 0 until markFrame() has run twice. */
  getFps(): number {
    if (this.frameTimes.length === 0) return 0
    const avg = this.frameTimes.reduce((s, v) => s + v, 0) / this.frameTimes.length
    return avg > 0 ? 1000 / avg : 0
  }
}
