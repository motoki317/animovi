import { describe, it, expect } from 'vitest'
import { solveHand, type HandLandmarks } from './hand-solver'

describe('HandSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: HandLandmarks = []

    const result = solveHand(landmarks, 'left')

    expect(result).toBeNull()
  })
})
