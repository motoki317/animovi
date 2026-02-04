import { describe, it, expect } from 'vitest'
import { solvePose, type PoseLandmarks } from './pose-solver'

describe('PoseSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: PoseLandmarks = []

    const result = solvePose(landmarks)

    expect(result).toBeNull()
  })
})
