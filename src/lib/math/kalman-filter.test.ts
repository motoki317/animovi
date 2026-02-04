import { describe, it, expect } from 'vitest'
import { KalmanFilter, KalmanFilter3D } from './kalman-filter'

describe('KalmanFilter', () => {
  it('should smooth noisy input by returning value between previous and current', () => {
    const filter = new KalmanFilter()

    // Initialize with first value
    filter.update(0)

    // Second update with noisy jump - should smooth it
    const smoothed = filter.update(10)

    // Smoothed value should be between 0 and 10, not exactly 10
    expect(smoothed).toBeGreaterThan(0)
    expect(smoothed).toBeLessThan(10)
  })

  it('should track faster with higher responsiveness', () => {
    const slowFilter = new KalmanFilter({ responsiveness: 0.2 })
    const fastFilter = new KalmanFilter({ responsiveness: 0.8 })

    // Initialize both
    slowFilter.update(0)
    fastFilter.update(0)

    // Update with same value
    const slowResult = slowFilter.update(10)
    const fastResult = fastFilter.update(10)

    // Higher responsiveness should track closer to new value
    expect(fastResult).toBeGreaterThan(slowResult)
  })

  it('should smooth 3D vectors component-wise', () => {
    const filter = new KalmanFilter3D()

    // Initialize with origin
    filter.update({ x: 0, y: 0, z: 0 })

    // Update with new position
    const smoothed = filter.update({ x: 10, y: 20, z: 30 })

    // Each component should be smoothed independently
    expect(smoothed.x).toBeGreaterThan(0)
    expect(smoothed.x).toBeLessThan(10)
    expect(smoothed.y).toBeGreaterThan(0)
    expect(smoothed.y).toBeLessThan(20)
    expect(smoothed.z).toBeGreaterThan(0)
    expect(smoothed.z).toBeLessThan(30)
  })

  it('should return exact value after reset', () => {
    const filter = new KalmanFilter()

    // Build up internal state
    filter.update(0)
    filter.update(10)
    filter.update(20)

    // Reset clears state
    filter.reset()

    // After reset, first update should return exact value (no smoothing)
    const result = filter.update(100)
    expect(result).toBe(100)
  })
})
