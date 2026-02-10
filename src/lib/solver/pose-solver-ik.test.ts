/**
 * Pose Solver IK Integration Tests
 *
 * Tests the full pipeline: MediaPipe landmarks → IK solver → VRM rotations
 * Uses fixture data to verify IK produces correct arm orientations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { solvePose, resetArmCalibration } from './pose-solver'
import {
  T_POSE,
  ARMS_FORWARD,
  ARMS_DOWN,
  ARMS_UP,
  ELBOWS_BENT,
  ALL_FIXTURES,
  LANDMARKS,
  type PoseFixture,
  type Vector3,
} from '../__fixtures__/pose-fixtures'

/** Normalize angle to [-π, π] */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

/** Check if angle is close to expected (with wraparound handling) */
function isAngleClose(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(normalizeAngle(actual - expected)) <= tolerance
}

/** Calculate distance between two 3D points */
function distance(a: Vector3, b: Vector3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

/** Convert MediaPipe coords to VRM space (matches production pose-solver.ts) */
function toVRMSpace(p: { x: number; y: number; z: number }): Vector3 {
  return {
    x: -(p.x - 0.5),
    y: -p.y,
    z: p.z,
  }
}

/**
 * Apply ZYX Euler rotation to a vector.
 * ZYX intrinsic: apply X first, then Y, then Z. Matrix: Rz * Ry * Rx
 * Matches Three.js Euler order 'ZYX'.
 */
function applyEulerZYX(v: Vector3, rx: number, ry: number, rz: number): Vector3 {
  const cosX = Math.cos(rx), sinX = Math.sin(rx)
  const cosY = Math.cos(ry), sinY = Math.sin(ry)
  const cosZ = Math.cos(rz), sinZ = Math.sin(rz)

  const x1 = v.x
  const y1 = v.y * cosX - v.z * sinX
  const z1 = v.y * sinX + v.z * cosX

  const x2 = x1 * cosY + z1 * sinY
  const y2 = y1
  const z2 = -x1 * sinY + z1 * cosY

  const x3 = x2 * cosZ - y2 * sinZ
  const y3 = x2 * sinZ + y2 * cosZ

  return { x: x3, y: y3, z: z2 }
}

/**
 * Forward Kinematics: Apply computed rotations using the bone hierarchy
 * and return wrist position.
 *
 * Bone hierarchy: worldDir = R_shoulder * R_elbow * tposeDir
 * This matches how Three.js applies parent * child rotations.
 */
function computeWristPositionFK(
  shoulderPos: Vector3,
  shoulderRot: Vector3,
  elbowRot: Vector3,
  upperArmLen: number,
  lowerArmLen: number,
  isLeft: boolean
): Vector3 {
  const tposeDir: Vector3 = isLeft ? { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 }

  // Upper arm direction: R_shoulder * tposeDir
  const upperArmDir = applyEulerZYX(tposeDir, shoulderRot.x, shoulderRot.y, shoulderRot.z)

  // Elbow position
  const elbowPos: Vector3 = {
    x: shoulderPos.x + upperArmDir.x * upperArmLen,
    y: shoulderPos.y + upperArmDir.y * upperArmLen,
    z: shoulderPos.z + upperArmDir.z * upperArmLen,
  }

  // Lower arm direction using bone hierarchy: R_shoulder * R_elbow * tposeDir
  // Step 1: Apply elbow rotation to tpose dir (in parent local space)
  const localForearmDir = applyEulerZYX(tposeDir, elbowRot.x, elbowRot.y, elbowRot.z)
  // Step 2: Apply shoulder rotation to get world direction
  const lowerArmDir = applyEulerZYX(localForearmDir, shoulderRot.x, shoulderRot.y, shoulderRot.z)

  // Wrist position
  return {
    x: elbowPos.x + lowerArmDir.x * lowerArmLen,
    y: elbowPos.y + lowerArmDir.y * lowerArmLen,
    z: elbowPos.z + lowerArmDir.z * lowerArmLen,
  }
}

describe('Pose Solver IK Integration Tests', () => {
  beforeEach(() => {
    resetArmCalibration()
  })

  describe('Basic Functionality', () => {
    it('should return PoseResult for valid landmarks', () => {
      const result = solvePose(T_POSE.landmarks)
      expect(result).not.toBeNull()
      expect(result!.leftArm).toBeDefined()
      expect(result!.rightArm).toBeDefined()
    })

    it('should return null for empty landmarks', () => {
      const result = solvePose([])
      expect(result).toBeNull()
    })
  })

  describe('T-Pose (Baseline)', () => {
    it('should produce near-zero rotations', () => {
      const result = solvePose(T_POSE.landmarks)!
      const tolerance = T_POSE.rotationTolerance ?? 0.3

      // In T-pose, arms are already in default position - rotations should be minimal
      expect(Math.abs(result.leftArm.shoulder.x)).toBeLessThan(tolerance)
      expect(Math.abs(result.leftArm.shoulder.z)).toBeLessThan(tolerance)
      expect(Math.abs(result.rightArm.shoulder.x)).toBeLessThan(tolerance)
      expect(Math.abs(result.rightArm.shoulder.z)).toBeLessThan(tolerance)
    })
  })

  describe('Arms Forward', () => {
    it('should produce Y rotation for forward arms', () => {
      const result = solvePose(ARMS_FORWARD.landmarks)!

      // Forward = shoulder rotated around Y axis
      // With scene PI rotation, arms toward viewer need model-backward (-Z) direction
      // Left arm: negative Y rotation rotates from -X to -Z
      // Right arm: positive Y rotation rotates from +X to -Z
      expect(result.leftArm.shoulder.y).toBeLessThan(-0.3)
      expect(result.rightArm.shoulder.y).toBeGreaterThan(0.3)
    })

    it('should have different Y vs Z rotation compared to arms down', () => {
      const forwardResult = solvePose(ARMS_FORWARD.landmarks)!
      const downResult = solvePose(ARMS_DOWN.landmarks)!

      // Forward primarily affects Y (yaw), down primarily affects Z (roll)
      const forwardTotalY = Math.abs(forwardResult.leftArm.shoulder.y) + Math.abs(forwardResult.rightArm.shoulder.y)
      const downTotalZ = Math.abs(downResult.leftArm.shoulder.z) + Math.abs(downResult.rightArm.shoulder.z)

      // Both should have significant rotation in their primary axis
      expect(forwardTotalY).toBeGreaterThan(0.5)
      expect(downTotalZ).toBeGreaterThan(0.5)
    })
  })

  describe('Arms Down', () => {
    it('should produce Z rotation for lowered arms', () => {
      const result = solvePose(ARMS_DOWN.landmarks)!

      // Left arm down = positive Z rotation
      // Right arm down = negative Z rotation
      expect(result.leftArm.shoulder.z).toBeGreaterThan(0.3)
      expect(result.rightArm.shoulder.z).toBeLessThan(-0.3)
    })
  })

  describe('Arms Up', () => {
    it('should produce opposite Z rotation from arms down', () => {
      const result = solvePose(ARMS_UP.landmarks)!

      // Left arm up = negative Z rotation (opposite of down)
      // Right arm up = positive Z rotation
      expect(result.leftArm.shoulder.z).toBeLessThan(-0.3)
      expect(result.rightArm.shoulder.z).toBeGreaterThan(0.3)
    })
  })

  describe('Elbow Bend', () => {
    it('should detect elbow flexion', () => {
      const result = solvePose(ELBOWS_BENT.landmarks)!

      // Bent elbow = significant X rotation (flexion)
      // Sign depends on Z convention; what matters is non-zero bend
      expect(Math.abs(result.leftArm!.elbow.x)).toBeGreaterThan(0.3)
      expect(Math.abs(result.rightArm!.elbow.x)).toBeGreaterThan(0.3)
    })
  })

  describe('Left/Right Symmetry', () => {
    it('should produce mirrored Z rotations for symmetric poses', () => {
      const result = solvePose(T_POSE.landmarks)!

      // Z rotation should be opposite for left and right arms
      const sumZ = result.leftArm.shoulder.z + result.rightArm.shoulder.z
      expect(Math.abs(sumZ)).toBeLessThan(0.3)
    })
  })
})

describe('IK Forward Kinematics Verification', () => {
  beforeEach(() => {
    resetArmCalibration()
  })

  it.each(ALL_FIXTURES)('$name: FK wrist should reach target position', (fixture: PoseFixture) => {
    const result = solvePose(fixture.landmarks)
    expect(result).not.toBeNull()

    // Get landmarks in VRM space
    const leftShoulder = toVRMSpace(fixture.landmarks[LANDMARKS.LEFT_SHOULDER])
    const rightShoulder = toVRMSpace(fixture.landmarks[LANDMARKS.RIGHT_SHOULDER])
    const leftElbow = toVRMSpace(fixture.landmarks[LANDMARKS.LEFT_ELBOW])
    const rightElbow = toVRMSpace(fixture.landmarks[LANDMARKS.RIGHT_ELBOW])
    const leftWristTarget = toVRMSpace(fixture.landmarks[LANDMARKS.LEFT_WRIST])
    const rightWristTarget = toVRMSpace(fixture.landmarks[LANDMARKS.RIGHT_WRIST])

    // Calculate arm lengths from landmarks
    const leftUpperLen = distance(leftShoulder, leftElbow)
    const leftLowerLen = distance(leftElbow, leftWristTarget)
    const rightUpperLen = distance(rightShoulder, rightElbow)
    const rightLowerLen = distance(rightElbow, rightWristTarget)

    // Compute wrist position using FK with the IK result
    const leftWristFK = computeWristPositionFK(
      leftShoulder,
      result!.leftArm.shoulder,
      result!.leftArm.elbow,
      leftUpperLen,
      leftLowerLen,
      true
    )
    const rightWristFK = computeWristPositionFK(
      rightShoulder,
      result!.rightArm.shoulder,
      result!.rightArm.elbow,
      rightUpperLen,
      rightLowerLen,
      false
    )

    // Verify FK wrist matches target position
    // With the bone hierarchy fix, FK is exact (distances ~0.0)
    const posTolerance = 0.01

    const leftDist = distance(leftWristFK, leftWristTarget)
    const rightDist = distance(rightWristFK, rightWristTarget)

    expect(leftDist).toBeLessThan(posTolerance)
    expect(rightDist).toBeLessThan(posTolerance)
  })
})

describe('Coordinate Transformation', () => {
  beforeEach(() => {
    resetArmCalibration()
  })

  it('should flip Y axis (MediaPipe Y-down to VRM Y-up)', () => {
    // Arms down in MediaPipe (higher Y) should result in arms down in VRM (positive Z for left)
    const result = solvePose(ARMS_DOWN.landmarks)!
    expect(result.leftArm.shoulder.z).toBeGreaterThan(0)
  })

  it('should keep Z sign (scene PI rotation handles coordinate flip)', () => {
    // Arms forward (negative Z in MediaPipe) should result in Y rotation
    // Left arm rotates from -X to -Z via negative Y rotation (scene rotation flips to viewer-facing)
    const result = solvePose(ARMS_FORWARD.landmarks)!
    expect(result.leftArm.shoulder.y).toBeLessThan(0)
  })
})
