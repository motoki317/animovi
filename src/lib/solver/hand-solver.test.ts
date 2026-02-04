import { describe, it, expect } from 'vitest'
import { solveHand, type HandLandmarks } from './hand-solver'

// MediaPipe Hand Landmarker returns 21 landmarks per hand
// Finger indices: thumb (1-4), index (5-8), middle (9-12), ring (13-16), pinky (17-20)
// 0 = wrist
function createOpenHandLandmarks(): HandLandmarks {
  const landmarks: HandLandmarks = []
  // Wrist at center
  landmarks[0] = { x: 0.5, y: 0.7, z: 0 }
  // Thumb (extended)
  landmarks[1] = { x: 0.35, y: 0.65, z: 0 }
  landmarks[2] = { x: 0.3, y: 0.6, z: 0 }
  landmarks[3] = { x: 0.25, y: 0.55, z: 0 }
  landmarks[4] = { x: 0.2, y: 0.5, z: 0 }
  // Index finger (extended - straight line up)
  landmarks[5] = { x: 0.4, y: 0.6, z: 0 }
  landmarks[6] = { x: 0.4, y: 0.5, z: 0 }
  landmarks[7] = { x: 0.4, y: 0.4, z: 0 }
  landmarks[8] = { x: 0.4, y: 0.3, z: 0 }
  // Middle finger (extended)
  landmarks[9] = { x: 0.5, y: 0.58, z: 0 }
  landmarks[10] = { x: 0.5, y: 0.48, z: 0 }
  landmarks[11] = { x: 0.5, y: 0.38, z: 0 }
  landmarks[12] = { x: 0.5, y: 0.28, z: 0 }
  // Ring finger (extended)
  landmarks[13] = { x: 0.6, y: 0.6, z: 0 }
  landmarks[14] = { x: 0.6, y: 0.5, z: 0 }
  landmarks[15] = { x: 0.6, y: 0.4, z: 0 }
  landmarks[16] = { x: 0.6, y: 0.3, z: 0 }
  // Pinky (extended)
  landmarks[17] = { x: 0.7, y: 0.62, z: 0 }
  landmarks[18] = { x: 0.7, y: 0.54, z: 0 }
  landmarks[19] = { x: 0.7, y: 0.46, z: 0 }
  landmarks[20] = { x: 0.7, y: 0.38, z: 0 }
  return landmarks
}

describe('HandSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: HandLandmarks = []

    const result = solveHand(landmarks, 'left')

    expect(result).toBeNull()
  })

  it('should detect low curl for extended fingers', () => {
    const landmarks = createOpenHandLandmarks()

    const result = solveHand(landmarks, 'left')

    expect(result).not.toBeNull()
    expect(result!.index.curl).toBeLessThan(0.3)
    expect(result!.middle.curl).toBeLessThan(0.3)
  })
})
