import { describe, it, expect } from 'vitest'
import { KalmanFilter } from './kalman-filter'

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
})
