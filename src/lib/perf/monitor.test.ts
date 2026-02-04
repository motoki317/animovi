import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerformanceMonitor, PerformanceMetrics } from './monitor'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    vi.useFakeTimers()
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should measure frame processing time', () => {
    monitor.startFrame()
    vi.advanceTimersByTime(8) // Simulate 8ms frame
    monitor.endFrame()

    const metrics = monitor.getMetrics()
    expect(metrics.lastFrameTime).toBeCloseTo(8, 0)
  })

  it('should detect when frame time exceeds 16ms', () => {
    const onWarning = vi.fn()
    monitor.onPerformanceWarning(onWarning)

    monitor.startFrame()
    vi.advanceTimersByTime(20) // Exceeds 16ms target
    monitor.endFrame()

    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'slow-frame',
        frameTime: expect.any(Number),
      })
    )
  })

  it('should not warn for frames under 16ms', () => {
    const onWarning = vi.fn()
    monitor.onPerformanceWarning(onWarning)

    monitor.startFrame()
    vi.advanceTimersByTime(10) // Under 16ms
    monitor.endFrame()

    expect(onWarning).not.toHaveBeenCalled()
  })

  it('should calculate rolling average FPS', () => {
    // Simulate several frames at ~60fps (16.67ms each)
    for (let i = 0; i < 60; i++) {
      monitor.startFrame()
      vi.advanceTimersByTime(16.67)
      monitor.endFrame()
    }

    const metrics = monitor.getMetrics()
    expect(metrics.averageFps).toBeCloseTo(60, 0)
  })

  it('should emit warnings when performance degrades', () => {
    const onWarning = vi.fn()
    monitor.onPerformanceWarning(onWarning)

    // Simulate consistently slow frames
    for (let i = 0; i < 10; i++) {
      monitor.startFrame()
      vi.advanceTimersByTime(33) // ~30fps
      monitor.endFrame()
    }

    // Should have emitted warnings for degraded performance
    expect(onWarning).toHaveBeenCalled()
  })

  it('should track frame count', () => {
    expect(monitor.getMetrics().frameCount).toBe(0)

    monitor.startFrame()
    vi.advanceTimersByTime(10)
    monitor.endFrame()

    monitor.startFrame()
    vi.advanceTimersByTime(10)
    monitor.endFrame()

    expect(monitor.getMetrics().frameCount).toBe(2)
  })

  it('should reset metrics', () => {
    monitor.startFrame()
    vi.advanceTimersByTime(10)
    monitor.endFrame()

    expect(monitor.getMetrics().frameCount).toBe(1)

    monitor.reset()

    expect(monitor.getMetrics().frameCount).toBe(0)
    expect(monitor.getMetrics().averageFps).toBe(0)
  })

  it('should remove warning listener', () => {
    const onWarning = vi.fn()
    const unsubscribe = monitor.onPerformanceWarning(onWarning)

    unsubscribe()

    monitor.startFrame()
    vi.advanceTimersByTime(20) // Slow frame
    monitor.endFrame()

    expect(onWarning).not.toHaveBeenCalled()
  })

  it('should provide metrics snapshot', () => {
    monitor.startFrame()
    vi.advanceTimersByTime(15)
    monitor.endFrame()

    const metrics: PerformanceMetrics = monitor.getMetrics()

    expect(metrics).toHaveProperty('lastFrameTime')
    expect(metrics).toHaveProperty('averageFps')
    expect(metrics).toHaveProperty('frameCount')
    expect(metrics).toHaveProperty('droppedFrames')
  })

  it('should count dropped frames when exceeding threshold', () => {
    // Several slow frames
    for (let i = 0; i < 5; i++) {
      monitor.startFrame()
      vi.advanceTimersByTime(25) // Exceeds 16ms
      monitor.endFrame()
    }

    expect(monitor.getMetrics().droppedFrames).toBe(5)
  })
})
