import { describe, it, expect } from 'vitest'
import { solvePose, type PoseLandmarks } from './pose-solver'

// MediaPipe Pose Landmarker returns 33 landmarks
// Key landmarks: shoulders (11, 12), elbows (13, 14), wrists (15, 16), hips (23, 24)
function createNeutralPoseLandmarks(): PoseLandmarks {
  const landmarks: PoseLandmarks = []
  for (let i = 0; i < 33; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: 1.0 })
  }
  // Neutral standing pose
  landmarks[11] = { x: 0.4, y: 0.3, z: 0, visibility: 1.0 } // left shoulder
  landmarks[12] = { x: 0.6, y: 0.3, z: 0, visibility: 1.0 } // right shoulder
  landmarks[13] = { x: 0.35, y: 0.5, z: 0, visibility: 1.0 } // left elbow
  landmarks[14] = { x: 0.65, y: 0.5, z: 0, visibility: 1.0 } // right elbow
  landmarks[23] = { x: 0.45, y: 0.7, z: 0, visibility: 1.0 } // left hip
  landmarks[24] = { x: 0.55, y: 0.7, z: 0, visibility: 1.0 } // right hip
  return landmarks
}

describe('PoseSolver', () => {
  it('should return null for empty landmarks array', () => {
    const landmarks: PoseLandmarks = []

    const result = solvePose(landmarks)

    expect(result).toBeNull()
  })

  it('should calculate near-zero spine rotation for neutral standing pose', () => {
    const landmarks = createNeutralPoseLandmarks()

    const result = solvePose(landmarks)

    expect(result).not.toBeNull()
    expect(result!.spine.pitch).toBeCloseTo(0, 1)
    expect(result!.spine.yaw).toBeCloseTo(0, 1)
    expect(result!.spine.roll).toBeCloseTo(0, 1)
  })

  it('should detect positive spine yaw when body turns right', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Right shoulder forward (larger z), left shoulder back
    landmarks[11] = { x: 0.4, y: 0.3, z: -0.05, visibility: 1.0 } // left shoulder back
    landmarks[12] = { x: 0.6, y: 0.3, z: 0.05, visibility: 1.0 } // right shoulder forward

    const result = solvePose(landmarks)

    expect(result).not.toBeNull()
    expect(result!.spine.yaw).toBeGreaterThan(0.1)
  })

  it('should return null when key landmarks have low visibility', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Set shoulders to low visibility (below threshold)
    landmarks[11] = { x: 0.4, y: 0.3, z: 0, visibility: 0.3 }
    landmarks[12] = { x: 0.6, y: 0.3, z: 0, visibility: 0.3 }

    const result = solvePose(landmarks)

    expect(result).toBeNull()
  })
})
