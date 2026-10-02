import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PipelineProfiler } from './pipeline-profiler'

describe('PipelineProfiler', () => {
  let profiler: PipelineProfiler
  let mockNow: number

  beforeEach(() => {
    mockNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    profiler = new PipelineProfiler(5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should track a single stage timing', () => {
    profiler.begin('mediapipe')
    mockNow = 10
    profiler.end('mediapipe')

    const timings = profiler.getTimings()
    expect(timings.mediapipe).toBeDefined()
    expect(timings.mediapipe.lastMs).toBe(10)
    expect(timings.mediapipe.avgMs).toBe(10)
  })

  it('should track multiple stages independently', () => {
    profiler.begin('mediapipe')
    mockNow = 8
    profiler.end('mediapipe')

    profiler.begin('solver')
    mockNow = 11
    profiler.end('solver')

    const timings = profiler.getTimings()
    expect(timings.mediapipe.lastMs).toBe(8)
    expect(timings.solver.lastMs).toBe(3)
  })

  it('should compute rolling average over window', () => {
    for (let i = 1; i <= 5; i++) {
      profiler.begin('stage')
      mockNow += i * 10
      profiler.end('stage')
    }

    const timings = profiler.getTimings()
    // Samples are 10, 20, 30, 40, 50.
    expect(timings.stage.avgMs).toBe(30)
  })

  it('should evict old samples beyond window size', () => {
    // Six samples into a window of 5: 100, then five 10s.
    profiler.begin('stage')
    mockNow += 100
    profiler.end('stage')

    for (let i = 0; i < 5; i++) {
      profiler.begin('stage')
      mockNow += 10
      profiler.end('stage')
    }

    const timings = profiler.getTimings()
    expect(timings.stage.avgMs).toBe(10)
  })

  it('should track max timing', () => {
    for (const ms of [5, 20, 10, 15, 8]) {
      profiler.begin('stage')
      mockNow += ms
      profiler.end('stage')
    }

    const timings = profiler.getTimings()
    expect(timings.stage.maxMs).toBe(20)
  })

  it('should compute total pipeline time', () => {
    profiler.begin('a')
    mockNow += 5
    profiler.end('a')

    profiler.begin('b')
    mockNow += 3
    profiler.end('b')

    expect(profiler.getTotalMs()).toBe(8)
  })

  it('should return empty timings when no data', () => {
    const timings = profiler.getTimings()
    expect(Object.keys(timings)).toHaveLength(0)
    expect(profiler.getTotalMs()).toBe(0)
  })

  it('should handle end without begin gracefully', () => {
    profiler.end('unknown')
    const timings = profiler.getTimings()
    expect(Object.keys(timings)).toHaveLength(0)
  })

  it('should track FPS from frame marks', () => {
    for (let i = 0; i < 5; i++) {
      profiler.markFrame()
      mockNow += 16.67
    }
    profiler.markFrame()

    expect(profiler.getFps()).toBeCloseTo(60, 0)
  })

  it('should return 0 FPS with no frame marks', () => {
    expect(profiler.getFps()).toBe(0)
  })
})
