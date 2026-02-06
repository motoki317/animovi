import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PipelineProfiler } from './pipeline-profiler'

describe('PipelineProfiler', () => {
  let profiler: PipelineProfiler
  let mockNow: number

  beforeEach(() => {
    mockNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    profiler = new PipelineProfiler(5) // Small window for testing
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
    // Add 5 samples: 10, 20, 30, 40, 50
    for (let i = 1; i <= 5; i++) {
      profiler.begin('stage')
      mockNow += i * 10
      profiler.end('stage')
    }

    const timings = profiler.getTimings()
    // Average of 10, 20, 30, 40, 50 = 30
    expect(timings.stage.avgMs).toBe(30)
  })

  it('should evict old samples beyond window size', () => {
    // Add 6 samples with window=5: 100, 10, 10, 10, 10, 10
    // First sample should be evicted
    profiler.begin('stage')
    mockNow += 100
    profiler.end('stage')

    for (let i = 0; i < 5; i++) {
      profiler.begin('stage')
      mockNow += 10
      profiler.end('stage')
    }

    const timings = profiler.getTimings()
    // Average of last 5: 10, 10, 10, 10, 10 = 10
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

    // Total = sum of last values for all stages
    expect(profiler.getTotalMs()).toBe(8)
  })

  it('should return empty timings when no data', () => {
    const timings = profiler.getTimings()
    expect(Object.keys(timings)).toHaveLength(0)
    expect(profiler.getTotalMs()).toBe(0)
  })

  it('should reset all data', () => {
    profiler.begin('stage')
    mockNow += 10
    profiler.end('stage')

    profiler.reset()

    const timings = profiler.getTimings()
    expect(Object.keys(timings)).toHaveLength(0)
  })

  it('should handle end without begin gracefully', () => {
    // Should not throw
    profiler.end('unknown')
    const timings = profiler.getTimings()
    expect(Object.keys(timings)).toHaveLength(0)
  })

  it('should track FPS from frame marks', () => {
    // Simulate 5 frames at 16.67ms intervals (60fps)
    for (let i = 0; i < 5; i++) {
      profiler.markFrame()
      mockNow += 16.67
    }
    profiler.markFrame() // Need one more to compute interval

    expect(profiler.getFps()).toBeCloseTo(60, 0)
  })

  it('should return 0 FPS with no frame marks', () => {
    expect(profiler.getFps()).toBe(0)
  })
})
