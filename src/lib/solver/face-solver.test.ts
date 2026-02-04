import { describe, it, expect } from 'vitest'
import { solveFace, type FaceLandmarks } from './face-solver'

describe('FaceSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: FaceLandmarks = []

    const result = solveFace(landmarks)

    expect(result).toBeNull()
  })
})
