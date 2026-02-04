import { describe, it, expect } from 'vitest'
import { solveFace, type FaceLandmarks } from './face-solver'

// MediaPipe Face Landmarker returns 478 landmarks
// Key landmarks for head rotation: nose tip (1), forehead (10), chin (152)
function createNeutralFaceLandmarks(): FaceLandmarks {
  const landmarks: FaceLandmarks = []
  for (let i = 0; i < 478; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0 })
  }
  // Position key landmarks for neutral pose (facing camera)
  landmarks[1] = { x: 0.5, y: 0.5, z: 0.05 } // nose tip (forward)
  landmarks[10] = { x: 0.5, y: 0.3, z: 0 } // forehead (above)
  landmarks[152] = { x: 0.5, y: 0.7, z: 0 } // chin (below)
  return landmarks
}

describe('FaceSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: FaceLandmarks = []

    const result = solveFace(landmarks)

    expect(result).toBeNull()
  })

  it('should calculate near-zero head rotation for neutral face pose', () => {
    const landmarks = createNeutralFaceLandmarks()

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    // Neutral pose should have near-zero rotation
    expect(result!.head.pitch).toBeCloseTo(0, 1)
    expect(result!.head.yaw).toBeCloseTo(0, 1)
    expect(result!.head.roll).toBeCloseTo(0, 1)
  })

  it('should detect positive yaw when face turns right', () => {
    const landmarks = createNeutralFaceLandmarks()
    // Shift nose to the left in image (face turned right from camera's view)
    landmarks[1] = { x: 0.3, y: 0.5, z: 0.02 }

    const result = solveFace(landmarks)

    expect(result).not.toBeNull()
    expect(result!.head.yaw).toBeGreaterThan(0.1)
  })
})
