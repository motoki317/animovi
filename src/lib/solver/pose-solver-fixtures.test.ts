/**
 * solvePose arm tests on pose fixtures: the sign of each shoulder angle, and a
 * forward-kinematics check that the solved rotations reproduce the landmark
 * wrist in solver space.
 */

import { describe, it, expect } from 'vitest'
import { solvePose, toSolverSpace, type ArmResult, type PoseLandmarks } from './pose-solver'
import { length, sub, type Vector3 } from '../math/vector'
import {
  T_POSE,
  ARMS_FORWARD,
  ARMS_DOWN,
  ARMS_UP,
  ELBOWS_BENT,
  ALL_FIXTURES,
  LANDMARKS,
  type PoseFixture,
} from '../__fixtures__/pose-fixtures'

function solveArms(landmarks: PoseLandmarks): { leftArm: ArmResult; rightArm: ArmResult } {
  const result = solvePose(landmarks)
  expect(result?.leftArm).toBeTruthy()
  expect(result?.rightArm).toBeTruthy()
  return { leftArm: result!.leftArm!, rightArm: result!.rightArm! }
}

function distance(a: Vector3, b: Vector3): number {
  return length(sub(a, b))
}

/** Rotates v by Euler angles in three.js order 'ZYX': Rz · Ry · Rx · v. */
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
 * Wrist position from the solved rotations. The elbow rotation is local to the
 * upper arm, so the forearm direction is R_shoulder · R_elbow · tposeDir.
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

  const upperArmDir = applyEulerZYX(tposeDir, shoulderRot.x, shoulderRot.y, shoulderRot.z)
  const elbowPos: Vector3 = {
    x: shoulderPos.x + upperArmDir.x * upperArmLen,
    y: shoulderPos.y + upperArmDir.y * upperArmLen,
    z: shoulderPos.z + upperArmDir.z * upperArmLen,
  }

  const localForearmDir = applyEulerZYX(tposeDir, elbowRot.x, elbowRot.y, elbowRot.z)
  const lowerArmDir = applyEulerZYX(localForearmDir, shoulderRot.x, shoulderRot.y, shoulderRot.z)

  return {
    x: elbowPos.x + lowerArmDir.x * lowerArmLen,
    y: elbowPos.y + lowerArmDir.y * lowerArmLen,
    z: elbowPos.z + lowerArmDir.z * lowerArmLen,
  }
}

describe('Pose Solver arm rotations', () => {
  describe('Basic Functionality', () => {
    it('should return PoseResult for valid landmarks', () => {
      const result = solvePose(T_POSE.landmarks)
      expect(result).not.toBeNull()
      expect(result!.leftArm).not.toBeNull()
      expect(result!.rightArm).not.toBeNull()
    })

    it('should return null for empty landmarks', () => {
      const result = solvePose([])
      expect(result).toBeNull()
    })
  })

  describe('T-Pose (Baseline)', () => {
    it('should produce near-zero rotations', () => {
      const result = solveArms(T_POSE.landmarks)
      const tolerance = 0.3

      expect(Math.abs(result.leftArm.shoulder.x)).toBeLessThan(tolerance)
      expect(Math.abs(result.leftArm.shoulder.z)).toBeLessThan(tolerance)
      expect(Math.abs(result.rightArm.shoulder.x)).toBeLessThan(tolerance)
      expect(Math.abs(result.rightArm.shoulder.z)).toBeLessThan(tolerance)
    })
  })

  describe('Arms Forward', () => {
    it('should produce Y rotation for forward arms', () => {
      const result = solveArms(ARMS_FORWARD.landmarks)

      // In solver space the avatar faces -Z. The left arm turns from -X to -Z
      // with a negative Y rotation, and the right arm from +X with a positive one.
      expect(result.leftArm.shoulder.y).toBeLessThan(-0.3)
      expect(result.rightArm.shoulder.y).toBeGreaterThan(0.3)
    })

    it('should have different Y vs Z rotation compared to arms down', () => {
      const forwardResult = solveArms(ARMS_FORWARD.landmarks)
      const downResult = solveArms(ARMS_DOWN.landmarks)

      const forwardTotalY = Math.abs(forwardResult.leftArm.shoulder.y) + Math.abs(forwardResult.rightArm.shoulder.y)
      const downTotalZ = Math.abs(downResult.leftArm.shoulder.z) + Math.abs(downResult.rightArm.shoulder.z)

      expect(forwardTotalY).toBeGreaterThan(0.5)
      expect(downTotalZ).toBeGreaterThan(0.5)
    })
  })

  describe('Arms Down', () => {
    it('should produce Z rotation for lowered arms', () => {
      const result = solveArms(ARMS_DOWN.landmarks)

      expect(result.leftArm.shoulder.z).toBeGreaterThan(0.3)
      expect(result.rightArm.shoulder.z).toBeLessThan(-0.3)
    })
  })

  describe('Arms Up', () => {
    it('should produce opposite Z rotation from arms down', () => {
      const result = solveArms(ARMS_UP.landmarks)

      expect(result.leftArm.shoulder.z).toBeLessThan(-0.3)
      expect(result.rightArm.shoulder.z).toBeGreaterThan(0.3)
    })
  })

  describe('Elbow Bend', () => {
    it('should detect elbow flexion as a 1DOF Y-axis hinge', () => {
      const result = solveArms(ELBOWS_BENT.landmarks)

      expect(Math.abs(result.leftArm.elbow.y)).toBeGreaterThan(0.3)
      expect(Math.abs(result.rightArm.elbow.y)).toBeGreaterThan(0.3)
      expect(Math.abs(result.leftArm.elbow.x)).toBeLessThan(0.01)
      expect(Math.abs(result.leftArm.elbow.z)).toBeLessThan(0.01)
      expect(Math.abs(result.rightArm.elbow.x)).toBeLessThan(0.01)
      expect(Math.abs(result.rightArm.elbow.z)).toBeLessThan(0.01)
    })
  })

  describe('Left/Right Symmetry', () => {
    it('should produce mirrored Z rotations for symmetric poses', () => {
      const result = solveArms(T_POSE.landmarks)

      const sumZ = result.leftArm.shoulder.z + result.rightArm.shoulder.z
      expect(Math.abs(sumZ)).toBeLessThan(0.3)
    })
  })
})

describe('Forward kinematics of solved arm rotations', () => {
  it.each(ALL_FIXTURES)('$name: FK wrist should reach target position', (fixture: PoseFixture) => {
    const result = solveArms(fixture.landmarks)

    const leftShoulder = toSolverSpace(fixture.landmarks[LANDMARKS.LEFT_SHOULDER])
    const rightShoulder = toSolverSpace(fixture.landmarks[LANDMARKS.RIGHT_SHOULDER])
    const leftElbow = toSolverSpace(fixture.landmarks[LANDMARKS.LEFT_ELBOW])
    const rightElbow = toSolverSpace(fixture.landmarks[LANDMARKS.RIGHT_ELBOW])
    const leftWristTarget = toSolverSpace(fixture.landmarks[LANDMARKS.LEFT_WRIST])
    const rightWristTarget = toSolverSpace(fixture.landmarks[LANDMARKS.RIGHT_WRIST])

    const leftWristFK = computeWristPositionFK(
      leftShoulder,
      result.leftArm.shoulder,
      result.leftArm.elbow,
      distance(leftShoulder, leftElbow),
      distance(leftElbow, leftWristTarget),
      true
    )
    const rightWristFK = computeWristPositionFK(
      rightShoulder,
      result.rightArm.shoulder,
      result.rightArm.elbow,
      distance(rightShoulder, rightElbow),
      distance(rightElbow, rightWristTarget),
      false
    )

    const posTolerance = 0.01
    expect(distance(leftWristFK, leftWristTarget)).toBeLessThan(posTolerance)
    expect(distance(rightWristFK, rightWristTarget)).toBeLessThan(posTolerance)
  })
})

describe('Coordinate Transformation', () => {
  it('should flip Y axis (MediaPipe Y-down to VRM Y-up)', () => {
    // A left arm below the shoulder in the image needs a positive Z rotation.
    const result = solveArms(ARMS_DOWN.landmarks)
    expect(result.leftArm.shoulder.z).toBeGreaterThan(0)
  })

  it('keeps the z sign, so toward the camera is the avatar front (-Z)', () => {
    // MediaPipe z is negative toward the camera, so the left arm turns from -X to -Z.
    const result = solveArms(ARMS_FORWARD.landmarks)
    expect(result.leftArm.shoulder.y).toBeLessThan(0)
  })
})
