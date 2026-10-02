import { describe, it, expect } from 'vitest'
import { ExponentialSmoother } from './exponential-smoother'

describe('ExponentialSmoother', () => {
  it('returns a value between the previous estimate and the new sample', () => {
    const smoother = new ExponentialSmoother()

    smoother.update(0)
    const smoothed = smoother.update(10)

    expect(smoothed).toBeGreaterThan(0)
    expect(smoothed).toBeLessThan(10)
  })

  it('tracks faster with higher responsiveness', () => {
    const slow = new ExponentialSmoother({ responsiveness: 0.2 })
    const fast = new ExponentialSmoother({ responsiveness: 0.8 })

    slow.update(0)
    fast.update(0)
    const slowResult = slow.update(10)
    const fastResult = fast.update(10)

    expect(fastResult).toBeGreaterThan(slowResult)
  })

  it('returns the first value unsmoothed', () => {
    const smoother = new ExponentialSmoother()

    expect(smoother.update(100)).toBe(100)
  })

  it('keeps its estimate when the responsiveness changes', () => {
    const smoother = new ExponentialSmoother({ responsiveness: 1 })
    smoother.update(0)

    smoother.responsiveness = 0.25

    expect(smoother.update(8)).toBe(2)
  })
})
