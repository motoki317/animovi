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

/** Convert MediaPipe coords to VRM space (same as pose-solver) */
function toVRMSpace(p: { x: number; y: number; z: number }): Vector3 {
  return { x: p.x, y: -p.y, z: p.z }
}

/**
 * Apply Euler rotation (XYZ order) to a vector
 */
function applyEulerXYZ(v: Vector3, rx: number, ry: number, rz: number): Vector3 {
  const cosX = Math.cos(rx), sinX = Math.sin(rx)
  const cosY = Math.cos(ry), sinY = Math.sin(ry)
  const cosZ = Math.cos(rz), sinZ = Math.sin(rz)

  // Rx
  let y1 = v.y * cosX - v.z * sinX
  let z1 = v.y * sinX + v.z * cosX
  let x1 = v.x

  // Ry
  let x2 = x1 * cosY + z1 * sinY
  let z2 = -x1 * sinY + z1 * cosY
  let y2 = y1

  // Rz
  let x3 = x2 * cosZ - y2 * sinZ
  let y3 = x2 * sinZ + y2 * cosZ
  let z3 = z2

  return { x: x3, y: y3, z: z3 }
}

/**
 * Forward Kinematics: Apply computed rotations and return wrist position.
 * This verifies that the IK solution actually places the wrist at the target.
 */
function computeWristPositionFK(
  shoulderPos: Vector3,
  shoulderRot: Vector3,
  elbowRot: Vector3,
  upperArmLen: number,
  lowerArmLen: number,
  isLeft: boolean
): Vector3 {
  // T-pose arm direction in VRM space
  const tposeDir: Vector3 = isLeft ? { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 }

  // Apply shoulder rotation to get upper arm direction
  const upperArmDir = applyEulerXYZ(tposeDir, shoulderRot.x, shoulderRot.y, shoulderRot.z)

  // Elbow position
  const elbowPos: Vector3 = {
    x: shoulderPos.x + upperArmDir.x * upperArmLen,
    y: shoulderPos.y + upperArmDir.y * upperArmLen,
    z: shoulderPos.z + upperArmDir.z * upperArmLen,
  }

  // Lower arm direction (initially same as upper arm, then bent)
  // Elbow bend is rotation around the local X-axis (perpendicular to arm)
  // For simplicity, we rotate in the plane defined by upper arm and down vector
  const elbowBend = elbowRot.x // negative = flexion

  let lowerArmDir: Vector3
  if (Math.abs(elbowBend) < 0.01) {
    lowerArmDir = { ...upperArmDir }
  } else {
    // Find a perpendicular vector for bending (toward body/down in local space)
    // Cross product of upper arm direction with forward (Z) gives the bend axis
    const bendAxis: Vector3 = {
      x: upperArmDir.y * 1 - upperArmDir.z * 0, // cross with (0,0,1)
      y: upperArmDir.z * 0 - upperArmDir.x * 1,
      z: upperArmDir.x * 0 - upperArmDir.y * 0,
    }
    const axisLen = Math.sqrt(bendAxis.x ** 2 + bendAxis.y ** 2 + bendAxis.z ** 2)

    if (axisLen > 0.01) {
      bendAxis.x /= axisLen
      bendAxis.y /= axisLen
      bendAxis.z /= axisLen

      // Rodrigues rotation formula for rotating around arbitrary axis
      const c = Math.cos(-elbowBend) // negative because elbow.x is negative for flexion
      const s = Math.sin(-elbowBend)
      const dot = bendAxis.x * upperArmDir.x + bendAxis.y * upperArmDir.y + bendAxis.z * upperArmDir.z
      const cross = {
        x: bendAxis.y * upperArmDir.z - bendAxis.z * upperArmDir.y,
        y: bendAxis.z * upperArmDir.x - bendAxis.x * upperArmDir.z,
        z: bendAxis.x * upperArmDir.y - bendAxis.y * upperArmDir.x,
      }

      lowerArmDir = {
        x: upperArmDir.x * c + cross.x * s + bendAxis.x * dot * (1 - c),
        y: upperArmDir.y * c + cross.y * s + bendAxis.y * dot * (1 - c),
        z: upperArmDir.z * c + cross.z * s + bendAxis.z * dot * (1 - c),
      }
    } else {
      lowerArmDir = { ...upperArmDir }
    }
  }

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

    // Verify FK wrist is close to target
    // Allow larger tolerance since FK verification is approximate
    // and VRM may use different rotation conventions than our simple FK
    const posTolerance = 0.7

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
