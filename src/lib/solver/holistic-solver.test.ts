import { describe, it, expect } from 'vitest'
import { solveHolistic, type HolisticLandmarks } from './holistic-solver'

describe('HolisticSolver', () => {
  it('should return result with face data when only face landmarks provided', () => {
    const landmarks: HolisticLandmarks = {
      face: createMinimalFaceLandmarks(),
      pose: [],
      leftHand: [],
      rightHand: [],
    }

    const result = solveHolistic(landmarks)

    expect(result).not.toBeNull()
    expect(result!.face).not.toBeNull()
    expect(result!.pose).toBeNull()
    expect(result!.leftHand).toBeNull()
    expect(result!.rightHand).toBeNull()
  })
})

// Minimal face landmarks for testing (478 points)
function createMinimalFaceLandmarks() {
  const landmarks = []
  for (let i = 0; i < 478; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0 })
  }
  return landmarks
}
