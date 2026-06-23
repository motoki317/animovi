import { describe, it, expect } from 'vitest'
import { solvePose, SPINE_YAW_GAIN, SPINE_YAW_CLAMP, type PoseLandmarks } from './pose-solver'

// Metric world pose landmarks for spine yaw. Forward pose: shoulder line along
// world -X (right shoulder 12 at smaller x than left shoulder 11), depth z ~0 —
// the convention measured from real footage.
function createWorldShoulders(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): PoseLandmarks {
  const lm: PoseLandmarks = []
  for (let i = 0; i < 33; i++) lm.push({ x: 0, y: 0, z: 0, visibility: 1.0 })
  lm[11] = { ...left, visibility: 1.0 }
  lm[12] = { ...right, visibility: 1.0 }
  return lm
}

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

  it('uses world landmarks for a near-zero spine yaw when facing forward', () => {
    const normalized = createNeutralPoseLandmarks()
    const world = createWorldShoulders({ x: 0.16, y: 0, z: 0 }, { x: -0.16, y: 0, z: 0 })

    const result = solvePose(normalized, world)

    expect(result!.spine.yaw).toBeCloseTo(0, 5)
  })

  it('derives spine yaw from the world shoulder-line angle, attenuated by SPINE_YAW_GAIN', () => {
    const normalized = createNeutralPoseLandmarks()
    // Right shoulder forward (+z), left back (-z): body turned to the right.
    const world = createWorldShoulders({ x: 0.16, y: 0, z: -0.1 }, { x: -0.16, y: 0, z: 0.1 })

    const result = solvePose(normalized, world)

    const rawAngle = Math.atan2(0.1 - -0.1, -(-0.16 - 0.16)) // atan2(Δz, -Δx)
    expect(result!.spine.yaw).toBeGreaterThan(0)
    expect(result!.spine.yaw).toBeCloseTo(rawAngle * SPINE_YAW_GAIN, 5)
  })

  it('keeps spine yaw small for a head-turn-sized shoulder perturbation', () => {
    // Real footage: a head turn shifts world shoulder depth ~0.37 m/rad. A ~15°
    // head turn (~0.096 m Δz over a ~0.32 m shoulder span) must move the body only
    // a few degrees, not the tens of degrees the old ×3 normalized formula gave.
    const normalized = createNeutralPoseLandmarks()
    const world = createWorldShoulders({ x: 0.16, y: 0, z: -0.048 }, { x: -0.16, y: 0, z: 0.048 })

    const result = solvePose(normalized, world)

    expect(Math.abs(result!.spine.yaw)).toBeLessThan((10 * Math.PI) / 180)
  })

  it('clamps spine yaw to ±SPINE_YAW_CLAMP at extreme turns', () => {
    const normalized = createNeutralPoseLandmarks()
    // Past-profile geometry whose raw angle exceeds the clamp even after attenuation.
    const world = createWorldShoulders({ x: -0.25, y: 0, z: -0.5 }, { x: 0.25, y: 0, z: 0.5 })

    const result = solvePose(normalized, world)

    expect(result!.spine.yaw).toBeCloseTo(SPINE_YAW_CLAMP, 5)
  })

  it('falls back to the legacy normalized estimate when world landmarks are absent', () => {
    const normalized = createNeutralPoseLandmarks()
    normalized[11] = { x: 0.4, y: 0.3, z: -0.05, visibility: 1.0 }
    normalized[12] = { x: 0.6, y: 0.3, z: 0.05, visibility: 1.0 }

    const withoutWorld = solvePose(normalized)
    const withEmptyWorld = solvePose(normalized, [])

    expect(withoutWorld!.spine.yaw).toBeCloseTo((0.05 - -0.05) * 3, 5)
    expect(withEmptyWorld!.spine.yaw).toBeCloseTo((0.05 - -0.05) * 3, 5)
  })

  it('should return null when key landmarks have low visibility', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Set shoulders to low visibility (below threshold)
    landmarks[11] = { x: 0.4, y: 0.3, z: 0, visibility: 0.3 }
    landmarks[12] = { x: 0.6, y: 0.3, z: 0, visibility: 0.3 }

    const result = solvePose(landmarks)

    expect(result).toBeNull()
  })

  it('should return null left arm when left arm landmarks have low visibility', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Left elbow and wrist not visible
    landmarks[13] = { x: 0.35, y: 0.5, z: 0, visibility: 0.2 }
    landmarks[15] = { x: 0.3, y: 0.7, z: 0, visibility: 0.2 }

    const result = solvePose(landmarks)

    expect(result).not.toBeNull()
    expect(result!.leftArm).toBeNull()
    expect(result!.rightArm).not.toBeNull()
  })

  it('should return null right arm when right arm landmarks have low visibility', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Right elbow and wrist not visible
    landmarks[14] = { x: 0.65, y: 0.5, z: 0, visibility: 0.2 }
    landmarks[16] = { x: 0.7, y: 0.7, z: 0, visibility: 0.2 }

    const result = solvePose(landmarks)

    expect(result).not.toBeNull()
    expect(result!.rightArm).toBeNull()
    expect(result!.leftArm).not.toBeNull()
  })

  it('should produce correct arm rotation when arms extended forward toward camera', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Arms straight forward toward camera (negative Z in MediaPipe = toward camera)
    landmarks[11] = { x: 0.4, y: 0.3, z: 0, visibility: 1.0 }    // left shoulder
    landmarks[13] = { x: 0.4, y: 0.3, z: -0.15, visibility: 1.0 } // left elbow forward
    landmarks[15] = { x: 0.4, y: 0.3, z: -0.30, visibility: 1.0 } // left wrist forward
    landmarks[12] = { x: 0.6, y: 0.3, z: 0, visibility: 1.0 }    // right shoulder
    landmarks[14] = { x: 0.6, y: 0.3, z: -0.15, visibility: 1.0 } // right elbow forward
    landmarks[16] = { x: 0.6, y: 0.3, z: -0.30, visibility: 1.0 } // right wrist forward

    const result = solvePose(landmarks)

    expect(result).not.toBeNull()
    expect(result!.leftArm).not.toBeNull()
    expect(result!.rightArm).not.toBeNull()
    // In VRM bone space, for the avatar's arms to appear pointing toward the viewer
    // (after PI scene rotation), bones must rotate toward model's -Z direction.
    // Left arm: T-pose {-1,0,0} → {0,0,-1} requires negative Y rotation
    expect(result!.leftArm!.shoulder.y).toBeLessThan(-0.3)
    // Right arm: T-pose {+1,0,0} → {0,0,-1} requires positive Y rotation
    expect(result!.rightArm!.shoulder.y).toBeGreaterThan(0.3)
  })

  it('should still compute arm when only wrist is low visibility but elbow is visible', () => {
    const landmarks = createNeutralPoseLandmarks()
    // Left wrist not visible, but shoulder and elbow are fine
    landmarks[15] = { x: 0.3, y: 0.7, z: 0, visibility: 0.2 }

    const result = solvePose(landmarks)

    expect(result).not.toBeNull()
    // When only wrist is missing, we can still compute shoulder rotation from elbow
    // The arm result should still be null since we can't reliably compute elbow rotation
    expect(result!.leftArm).toBeNull()
  })
})
