import { describe, it, expect } from 'vitest'
import { solveArmDirect, clampArmRotation, type Vector3 } from './two-bone-ik'

// Legacy IK solver tests removed - project uses direct solver approach
// See solveArmDirect tests below

describe.skip('Two-Bone IK Solver (legacy)', () => {
  describe('calculateArmLengths', () => {
    it('should calculate segment lengths from positions', () => {
      const shoulder: Vector3 = { x: 0, y: 0, z: 0 }
      const elbow: Vector3 = { x: 1, y: 0, z: 0 }
      const wrist: Vector3 = { x: 2, y: 0, z: 0 }

      const { upperArmLength, lowerArmLength } = calculateArmLengths(shoulder, elbow, wrist)

      expect(upperArmLength).toBeCloseTo(1.0)
      expect(lowerArmLength).toBeCloseTo(1.0)
    })

    it('should handle diagonal positions', () => {
      const shoulder: Vector3 = { x: 0, y: 0, z: 0 }
      const elbow: Vector3 = { x: 1, y: 1, z: 0 }
      const wrist: Vector3 = { x: 2, y: 1, z: 0 }

      const { upperArmLength, lowerArmLength } = calculateArmLengths(shoulder, elbow, wrist)

      expect(upperArmLength).toBeCloseTo(Math.sqrt(2))
      expect(lowerArmLength).toBeCloseTo(1.0)
    })
  })

  describe('solveTwoBoneIK', () => {
    const defaultInput = {
      shoulder: { x: 0, y: 0, z: 0 } as Vector3,
      target: { x: 1.5, y: 0, z: 0 } as Vector3,
      upperArmLength: 1.0,
      lowerArmLength: 1.0,
      poleHint: { x: 0.5, y: 0.5, z: 0 } as Vector3,
      isLeft: true,
    }

    it('should return reachable=true when target is within reach', () => {
      const result = solveTwoBoneIK(defaultInput)

      expect(result.reachable).toBe(true)
    })

    it('should return reachable=false when target is too far', () => {
      const result = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 3.0, y: 0, z: 0 }, // Beyond reach (1 + 1 = 2 max)
      })

      expect(result.reachable).toBe(false)
    })

    it('should produce elbow bend when target is closer than arm length', () => {
      const result = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 1.0, y: 0, z: 0 }, // Requires elbow bend
      })

      // Elbow should be bent (negative X rotation)
      expect(result.elbow.x).toBeLessThan(0)
    })

    it('should produce minimal elbow bend when arm is straight', () => {
      const result = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 1.99, y: 0, z: 0 }, // Almost fully extended
      })

      // Elbow should be nearly straight (close to 0)
      expect(Math.abs(result.elbow.x)).toBeLessThan(0.5)
    })

    it('should handle target below shoulder (arm pointing down)', () => {
      const result = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 0, y: 1.5, z: 0 }, // Below shoulder
      })

      // Should produce valid result with shoulder Z rotation
      expect(result.shoulder.z).not.toBe(0)
    })

    it('should handle target in front (arm forward)', () => {
      const result = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 0, y: 0, z: -1.5 }, // In front
      })

      // Should produce forward rotation (positive X based on our convention)
      expect(result.shoulder.x).toBeGreaterThan(0)
    })

    it('should use pole hint to determine elbow direction', () => {
      // Two solves with different pole hints should produce different upper arm directions
      // Use a target that requires significant elbow bend to see the pole effect
      const result1 = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 0.8, y: 0.8, z: 0 }, // Diagonal target requiring bend
        poleHint: { x: 0.4, y: 0.4, z: -1.0 }, // Elbow forward
      })

      const result2 = solveTwoBoneIK({
        ...defaultInput,
        target: { x: 0.8, y: 0.8, z: 0 }, // Same target
        poleHint: { x: 0.4, y: 0.4, z: 1.0 }, // Elbow backward
      })

      // The shoulder rotations should differ based on pole hint
      // At least one axis should be different
      const xDiff = Math.abs(result1.shoulder.x - result2.shoulder.x)
      const yDiff = Math.abs(result1.shoulder.y - result2.shoulder.y)
      const zDiff = Math.abs(result1.shoulder.z - result2.shoulder.z)
      const totalDiff = xDiff + yDiff + zDiff

      // There should be some difference in shoulder rotation due to pole hint
      expect(totalDiff).toBeGreaterThan(0.01)
    })

    it('should handle right arm (mirrored)', () => {
      const leftResult = solveTwoBoneIK({
        ...defaultInput,
        isLeft: true,
      })

      const rightResult = solveTwoBoneIK({
        ...defaultInput,
        isLeft: false,
      })

      // Left and right should have opposite Z rotation signs
      expect(Math.sign(leftResult.shoulder.z)).toBe(-Math.sign(rightResult.shoulder.z))
    })

    describe('ZYX Euler order verification', () => {
      /**
       * Apply ZYX Euler rotation to a vector.
       * ZYX intrinsic order: when applied to a vector, the operations happen as X first, then Y, then Z.
       * This matches Three.js behavior for euler.order = 'ZYX'.
       */
      function applyEulerZYX(v: Vector3, x: number, y: number, z: number): Vector3 {
        const cosX = Math.cos(x), sinX = Math.sin(x)
        const cosY = Math.cos(y), sinY = Math.sin(y)
        const cosZ = Math.cos(z), sinZ = Math.sin(z)

        // Apply X rotation first
        let x1 = v.x
        let y1 = v.y * cosX - v.z * sinX
        let z1 = v.y * sinX + v.z * cosX

        // Then Y rotation
        let x2 = x1 * cosY + z1 * sinY
        let y2 = y1
        let z2 = -x1 * sinY + z1 * cosY

        // Finally Z rotation
        let x3 = x2 * cosZ - y2 * sinZ
        let y3 = x2 * sinZ + y2 * cosZ
        let z3 = z2

        return { x: x3, y: y3, z: z3 }
      }

      function normalize(v: Vector3): Vector3 {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
        if (len === 0) return { x: 0, y: 0, z: 0 }
        return { x: v.x / len, y: v.y / len, z: v.z / len }
      }

      function dot(a: Vector3, b: Vector3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z
      }

      it('should produce rotations that work correctly with ZYX order for forward target', () => {
        const result = solveTwoBoneIK({
          shoulder: { x: 0, y: 0, z: 0 },
          target: { x: 0, y: 0, z: -1.5 }, // Forward (negative Z in VRM)
          upperArmLength: 1.0,
          lowerArmLength: 1.0,
          poleHint: { x: 0, y: -0.5, z: -0.5 },
          isLeft: true,
        })

        // T-pose direction for left arm
        const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }

        // Apply shoulder rotation using ZYX order
        const rotatedDir = applyEulerZYX(
          tposeDir,
          result.shoulder.x,
          result.shoulder.y,
          result.shoulder.z
        )

        // The rotated direction should point roughly forward (negative Z)
        // Allowing for some deviation due to elbow bend offset
        expect(rotatedDir.z).toBeLessThan(-0.5) // Should have significant forward component
      })

      it('should produce rotations that work correctly with ZYX order for downward target', () => {
        const result = solveTwoBoneIK({
          shoulder: { x: 0, y: 0, z: 0 },
          target: { x: 0, y: -1.5, z: 0 }, // Down (negative Y in VRM)
          upperArmLength: 1.0,
          lowerArmLength: 1.0,
          poleHint: { x: 0, y: -0.5, z: -0.5 },
          isLeft: true,
        })

        // T-pose direction for left arm
        const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }

        // Apply shoulder rotation using ZYX order
        const rotatedDir = applyEulerZYX(
          tposeDir,
          result.shoulder.x,
          result.shoulder.y,
          result.shoulder.z
        )

        // The rotated direction should point roughly downward (negative Y)
        expect(rotatedDir.y).toBeLessThan(-0.5) // Should have significant downward component
      })

      it('should produce rotations that work correctly with ZYX order for upward target', () => {
        const result = solveTwoBoneIK({
          shoulder: { x: 0, y: 0, z: 0 },
          target: { x: 0, y: 1.5, z: 0 }, // Up (positive Y in VRM)
          upperArmLength: 1.0,
          lowerArmLength: 1.0,
          poleHint: { x: 0, y: 0.5, z: -0.5 },
          isLeft: true,
        })

        // T-pose direction for left arm
        const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }

        // Apply shoulder rotation using ZYX order
        const rotatedDir = applyEulerZYX(
          tposeDir,
          result.shoulder.x,
          result.shoulder.y,
          result.shoulder.z
        )

        // The rotated direction should point roughly upward (positive Y)
        expect(rotatedDir.y).toBeGreaterThan(0.5) // Should have significant upward component
      })
    })
  })
})

describe('Direct Vector-to-Euler Approach (KalidoKit-style)', () => {
  /**
   * Compute rotation from T-pose to a target direction using ZYX Euler angles.
   * This is the KalidoKit-style direct approach - no IK involved.
   */
  function directionToEulerZYX(
    from: Vector3,
    to: Vector3
  ): { x: number; y: number; z: number } {
    // Normalize vectors
    const fromLen = Math.sqrt(from.x ** 2 + from.y ** 2 + from.z ** 2)
    const toLen = Math.sqrt(to.x ** 2 + to.y ** 2 + to.z ** 2)
    if (fromLen < 0.001 || toLen < 0.001) {
      return { x: 0, y: 0, z: 0 }
    }
    const fromNorm = { x: from.x / fromLen, y: from.y / fromLen, z: from.z / fromLen }
    const toNorm = { x: to.x / toLen, y: to.y / toLen, z: to.z / toLen }

    // Compute rotation quaternion from fromNorm to toNorm
    const d = fromNorm.x * toNorm.x + fromNorm.y * toNorm.y + fromNorm.z * toNorm.z
    const c = {
      x: fromNorm.y * toNorm.z - fromNorm.z * toNorm.y,
      y: fromNorm.z * toNorm.x - fromNorm.x * toNorm.z,
      z: fromNorm.x * toNorm.y - fromNorm.y * toNorm.x,
    }
    const crossLen = Math.sqrt(c.x ** 2 + c.y ** 2 + c.z ** 2)

    if (crossLen < 0.001) {
      // Parallel vectors
      return d > 0 ? { x: 0, y: 0, z: 0 } : { x: 0, y: Math.PI, z: 0 }
    }

    const axis = { x: c.x / crossLen, y: c.y / crossLen, z: c.z / crossLen }
    const angle = Math.acos(Math.max(-1, Math.min(1, d)))

    // Axis-angle to quaternion
    const ha = angle / 2
    const qx = axis.x * Math.sin(ha)
    const qy = axis.y * Math.sin(ha)
    const qz = axis.z * Math.sin(ha)
    const qw = Math.cos(ha)

    // Quaternion to ZYX Euler
    const sinY = 2 * (qw * qy - qx * qz)
    if (Math.abs(sinY) >= 0.9999999) {
      return {
        x: 0,
        y: (Math.PI / 2) * Math.sign(sinY),
        z: Math.atan2(-(2 * (qx * qy - qw * qz)), 1 - 2 * (qx * qx + qz * qz)),
      }
    }

    return {
      x: Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)),
      y: Math.asin(sinY),
      z: Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)),
    }
  }

  /**
   * Compute arm rotations directly from landmarks (KalidoKit-style).
   * Uses actual shoulder→elbow and elbow→wrist directions instead of IK.
   */
  function solveArmDirect(
    shoulder: Vector3,
    elbow: Vector3,
    wrist: Vector3,
    isLeft: boolean
  ): { shoulder: { x: number; y: number; z: number }; elbow: { x: number; y: number; z: number } } {
    const tposeDir = isLeft ? { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 }

    // Upper arm direction: shoulder → elbow
    const upperArmDir = {
      x: elbow.x - shoulder.x,
      y: elbow.y - shoulder.y,
      z: elbow.z - shoulder.z,
    }

    // Compute shoulder rotation: T-pose → upper arm direction
    const shoulderRot = directionToEulerZYX(tposeDir, upperArmDir)

    // Lower arm direction: elbow → wrist
    const lowerArmDir = {
      x: wrist.x - elbow.x,
      y: wrist.y - elbow.y,
      z: wrist.z - elbow.z,
    }

    // Elbow bend: angle between upper and lower arm
    const upperLen = Math.sqrt(upperArmDir.x ** 2 + upperArmDir.y ** 2 + upperArmDir.z ** 2)
    const lowerLen = Math.sqrt(lowerArmDir.x ** 2 + lowerArmDir.y ** 2 + lowerArmDir.z ** 2)
    if (upperLen < 0.001 || lowerLen < 0.001) {
      return { shoulder: shoulderRot, elbow: { x: 0, y: 0, z: 0 } }
    }

    // Dot product gives cos(angle between vectors)
    // When vectors point in same direction, dot = 1, angle = 0 (arm is straight)
    // When vectors are perpendicular, dot = 0, angle = π/2 (90° bend)
    const dotProduct =
      (upperArmDir.x * lowerArmDir.x + upperArmDir.y * lowerArmDir.y + upperArmDir.z * lowerArmDir.z) /
      (upperLen * lowerLen)
    const angleBetween = Math.acos(Math.max(-1, Math.min(1, dotProduct)))

    // Elbow flexion: 0 when straight (angle = 0), increases as arm bends
    const elbowBend = angleBetween

    return {
      shoulder: shoulderRot,
      elbow: { x: -elbowBend, y: 0, z: 0 },
    }
  }

  it('should compute correct shoulder rotation for arm pointing forward', () => {
    // Left arm pointing forward (negative Z)
    const shoulder = { x: 0, y: 0, z: 0 }
    const elbow = { x: 0, y: 0, z: -1 }
    const wrist = { x: 0, y: 0, z: -2 }

    const result = solveArmDirect(shoulder, elbow, wrist, true)

    // T-pose for left arm is (-1, 0, 0), target is (0, 0, -1)
    // This requires -90° rotation around Y axis
    expect(result.shoulder.y).toBeCloseTo(-Math.PI / 2, 1)
    expect(result.elbow.x).toBeCloseTo(0, 1) // Arm is straight
  })

  it('should compute correct shoulder rotation for arm pointing down', () => {
    // Left arm pointing down (negative Y)
    const shoulder = { x: 0, y: 0, z: 0 }
    const elbow = { x: 0, y: -1, z: 0 }
    const wrist = { x: 0, y: -2, z: 0 }

    const result = solveArmDirect(shoulder, elbow, wrist, true)

    // T-pose for left arm is (-1, 0, 0), target is (0, -1, 0)
    // This requires +90° rotation around Z axis
    expect(result.shoulder.z).toBeCloseTo(Math.PI / 2, 1)
    expect(result.elbow.x).toBeCloseTo(0, 1) // Arm is straight
  })

  it('should compute elbow bend for bent arm', () => {
    // Left arm with 90° elbow bend
    const shoulder = { x: 0, y: 0, z: 0 }
    const elbow = { x: 0, y: -1, z: 0 } // Upper arm points down
    const wrist = { x: 0, y: -1, z: -1 } // Lower arm points forward

    const result = solveArmDirect(shoulder, elbow, wrist, true)

    // 90° bend = π/2 flexion
    expect(result.elbow.x).toBeCloseTo(-Math.PI / 2, 1)
  })

  it('should handle right arm mirroring correctly', () => {
    // Right arm pointing forward
    const shoulder = { x: 0, y: 0, z: 0 }
    const elbow = { x: 0, y: 0, z: -1 }
    const wrist = { x: 0, y: 0, z: -2 }

    const result = solveArmDirect(shoulder, elbow, wrist, false)

    // T-pose for right arm is (+1, 0, 0), target is (0, 0, -1)
    // This requires +90° rotation around Y axis (opposite of left arm)
    expect(result.shoulder.y).toBeCloseTo(Math.PI / 2, 1)
  })
})

describe('solveArmDirect - elbow full 3DOF rotation', () => {
  /**
   * Apply ZYX Euler rotation to a vector.
   * ZYX intrinsic order: X first, then Y, then Z.
   */
  function applyEulerZYX(v: Vector3, x: number, y: number, z: number): Vector3 {
    const cosX = Math.cos(x), sinX = Math.sin(x)
    const cosY = Math.cos(y), sinY = Math.sin(y)
    const cosZ = Math.cos(z), sinZ = Math.sin(z)

    // Apply X rotation first
    const x1 = v.x
    const y1 = v.y * cosX - v.z * sinX
    const z1 = v.y * sinX + v.z * cosX

    // Then Y rotation
    const x2 = x1 * cosY + z1 * sinY
    const y2 = y1
    const z2 = -x1 * sinY + z1 * cosY

    // Finally Z rotation
    const x3 = x2 * cosZ - y2 * sinZ
    const y3 = x2 * sinZ + y2 * cosZ
    const z3 = z2

    return { x: x3, y: y3, z: z3 }
  }

  function vecNormalize(v: Vector3): Vector3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    if (len === 0) return { x: 0, y: 0, z: 0 }
    return { x: v.x / len, y: v.y / len, z: v.z / len }
  }

  function vecDot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z
  }

  it('should produce identity elbow rotation when arm is straight', () => {
    // Left arm: upper arm and lower arm both point down
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -2, z: 0 },
      isLeft: true,
    })

    // When arm is straight, the elbow should have ~zero rotation
    expect(Math.abs(result.elbow.x)).toBeLessThan(0.1)
    expect(Math.abs(result.elbow.y)).toBeLessThan(0.1)
    expect(Math.abs(result.elbow.z)).toBeLessThan(0.1)
  })

  it('should produce correct elbow rotation when forearm bends forward from downward upper arm', () => {
    // Upper arm points down, forearm points forward
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -1, z: -1 },
      isLeft: true,
    })

    // Bone hierarchy FK: worldDir = R_shoulder * R_elbow * tposeDir
    const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }
    // Step 1: Apply elbow rotation to tpose dir (in parent local space)
    const localResult = applyEulerZYX(tposeDir, result.elbow.x, result.elbow.y, result.elbow.z)
    // Step 2: Apply shoulder rotation to get world direction
    const forearmWorldDir = applyEulerZYX(localResult, result.shoulder.x, result.shoulder.y, result.shoulder.z)

    const lowerArmDir = vecNormalize({ x: 0, y: 0, z: -1 })
    // The bone hierarchy forearm direction should match the actual lower arm direction
    expect(vecDot(vecNormalize(forearmWorldDir), lowerArmDir)).toBeGreaterThan(0.9)
  })

  it('should produce correct elbow rotation when forearm bends inward', () => {
    // Left arm: upper arm points left (-x), forearm bends down
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: -1, y: 0, z: 0 },
      wrist: { x: -1, y: -1, z: 0 },
      isLeft: true,
    })

    // Bone hierarchy FK: worldDir = R_shoulder * R_elbow * tposeDir
    const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }
    const localResult = applyEulerZYX(tposeDir, result.elbow.x, result.elbow.y, result.elbow.z)
    const forearmWorldDir = applyEulerZYX(localResult, result.shoulder.x, result.shoulder.y, result.shoulder.z)

    const lowerArmDir = vecNormalize({ x: 0, y: -1, z: 0 })
    expect(vecDot(vecNormalize(forearmWorldDir), lowerArmDir)).toBeGreaterThan(0.9)
  })

  it('should produce correct end-to-end arm direction using both shoulder and elbow rotations', () => {
    // Left arm: upper arm points down, forearm bends forward
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -1, z: -1 },
      isLeft: true,
    })

    // T-pose direction for left arm
    const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }

    // Apply shoulder rotation to get upper arm direction
    const upperArmResult = applyEulerZYX(
      tposeDir,
      result.shoulder.x,
      result.shoulder.y,
      result.shoulder.z,
    )

    // Upper arm should point roughly downward
    expect(upperArmResult.y).toBeLessThan(-0.8)

    // Bone hierarchy FK: worldDir = R_shoulder * R_elbow * tposeDir
    // Step 1: Apply elbow rotation to tpose (in parent local space)
    const elbowResult = applyEulerZYX(
      tposeDir,
      result.elbow.x,
      result.elbow.y,
      result.elbow.z,
    )
    // Step 2: Apply shoulder rotation to get world forearm direction
    const forearmResult = applyEulerZYX(
      elbowResult,
      result.shoulder.x,
      result.shoulder.y,
      result.shoulder.z,
    )

    // Forearm should point roughly forward (negative Z)
    expect(forearmResult.z).toBeLessThan(-0.8)
  })
})

/**
 * BUG HYPOTHESIS: Elbow rotation is computed in world space but the VRM bone
 * hierarchy applies it in the parent (upper arm) bone's local space.
 *
 * In Three.js bone hierarchy:
 *   lowerArm_world_dir = R_shoulder * R_elbow * tposeDir
 *
 * But solveArmDirect computes R_elbow such that:
 *   R_elbow * R_shoulder * tposeDir = lowerArmDir   (wrong order!)
 *
 * These differ because rotation composition is NOT commutative.
 * When the shoulder has significant rotation (arms raised, extended),
 * the elbow rotation rotates around wrong axes, often having zero effect.
 */
describe('Elbow rotation in parent-local space - bone hierarchy FK', () => {
  /**
   * Apply ZYX Euler rotation to a vector.
   * ZYX intrinsic order: apply X first, then Y, then Z.
   * Matrix form: M = Rz * Ry * Rx (matches Three.js Euler order 'ZYX')
   */
  function applyEulerZYX(v: Vector3, x: number, y: number, z: number): Vector3 {
    const cosX = Math.cos(x), sinX = Math.sin(x)
    const cosY = Math.cos(y), sinY = Math.sin(y)
    const cosZ = Math.cos(z), sinZ = Math.sin(z)
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
   * Bone hierarchy FK: computes the forearm direction in world space
   * using the CORRECT bone hierarchy order.
   *
   * In Three.js: child_world = parent_world * child_local
   * So: forearm_dir = R_shoulder * (R_elbow * tposeDir)
   */
  function boneHierarchyForearmDir(
    tposeDir: Vector3,
    shoulderRot: Vector3,
    elbowRot: Vector3,
  ): Vector3 {
    // Step 1: Apply elbow rotation to tpose direction (in parent local space)
    const localResult = applyEulerZYX(tposeDir, elbowRot.x, elbowRot.y, elbowRot.z)
    // Step 2: Apply shoulder rotation to get world direction
    return applyEulerZYX(localResult, shoulderRot.x, shoulderRot.y, shoulderRot.z)
  }

  function vecNormalize(v: Vector3): Vector3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    if (len === 0) return { x: 0, y: 0, z: 0 }
    return { x: v.x / len, y: v.y / len, z: v.z / len }
  }

  function vecDot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z
  }

  it('left arm raised up + forearm pointing forward: bone FK should match target direction', () => {
    // Scenario: Left arm raised straight up, forearm bends forward
    // This is a common "surrender" or "hands up" pose
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 1, z: 0 },    // upper arm points up
      wrist: { x: 0, y: 1, z: -1 },    // forearm points forward
      isLeft: true,
    })

    const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }
    const expectedLowerArmDir = vecNormalize({ x: 0, y: 0, z: -1 }) // forward

    // Use the CORRECT bone hierarchy FK: R_shoulder * R_elbow * tposeDir
    const forearmDir = boneHierarchyForearmDir(tposeDir, result.shoulder, result.elbow)
    const forearmNorm = vecNormalize(forearmDir)

    // The forearm should point roughly forward (negative Z)
    // Using dot product > 0.8 means directions are within ~37° of each other
    expect(vecDot(forearmNorm, expectedLowerArmDir)).toBeGreaterThan(0.8)
  })

  it('left arm pointing forward + forearm bending down: bone FK should match target direction', () => {
    // Scenario: Left arm extends forward, forearm bends downward
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: -1 },    // upper arm points forward
      wrist: { x: 0, y: -1, z: -1 },    // forearm points down
      isLeft: true,
    })

    const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }
    const expectedLowerArmDir = vecNormalize({ x: 0, y: -1, z: 0 }) // down

    const forearmDir = boneHierarchyForearmDir(tposeDir, result.shoulder, result.elbow)
    const forearmNorm = vecNormalize(forearmDir)

    expect(vecDot(forearmNorm, expectedLowerArmDir)).toBeGreaterThan(0.8)
  })

  it('right arm raised up + forearm pointing forward: bone FK should match target direction', () => {
    // Mirror of first test for right arm
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 1, z: 0 },    // upper arm points up
      wrist: { x: 0, y: 1, z: -1 },    // forearm points forward
      isLeft: false,
    })

    const tposeDir: Vector3 = { x: 1, y: 0, z: 0 }
    const expectedLowerArmDir = vecNormalize({ x: 0, y: 0, z: -1 }) // forward

    const forearmDir = boneHierarchyForearmDir(tposeDir, result.shoulder, result.elbow)
    const forearmNorm = vecNormalize(forearmDir)

    expect(vecDot(forearmNorm, expectedLowerArmDir)).toBeGreaterThan(0.8)
  })

  it('left arm raised diagonally + forearm bending inward: bone FK should match target direction', () => {
    // Scenario: More realistic - arm raised up and slightly forward, forearm bends inward
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: -0.3, y: 1, z: -0.3 },   // upper arm mostly up, slightly left+forward
      wrist: { x: -0.3, y: 1.7, z: -0.8 },  // forearm continues up and more forward
      isLeft: true,
    })

    const tposeDir: Vector3 = { x: -1, y: 0, z: 0 }
    // Expected lower arm direction: wrist - elbow
    const expectedLowerArmDir = vecNormalize({ x: 0, y: 0.7, z: -0.5 })

    const forearmDir = boneHierarchyForearmDir(tposeDir, result.shoulder, result.elbow)
    const forearmNorm = vecNormalize(forearmDir)

    expect(vecDot(forearmNorm, expectedLowerArmDir)).toBeGreaterThan(0.8)
  })
})

describe('clampArmRotation', () => {
  it('should pass through rotations within anatomical limits', () => {
    const result = clampArmRotation({
      shoulder: { x: 0.5, y: 0.3, z: -0.2 },
      elbow: { x: -0.8, y: 0, z: 0 },
      reachable: true,
    })

    expect(result.shoulder.x).toBeCloseTo(0.5)
    expect(result.shoulder.y).toBeCloseTo(0.3)
    expect(result.shoulder.z).toBeCloseTo(-0.2)
    expect(result.elbow.x).toBeCloseTo(-0.8)
  })

  it('should clamp shoulder X rotation to [-PI/2, PI]', () => {
    const result = clampArmRotation({
      shoulder: { x: 4, y: 0, z: 0 }, // > PI
      elbow: { x: 0, y: 0, z: 0 },
      reachable: true,
    })

    expect(result.shoulder.x).toBeLessThanOrEqual(Math.PI)

    const result2 = clampArmRotation({
      shoulder: { x: -2, y: 0, z: 0 }, // < -PI/2
      elbow: { x: 0, y: 0, z: 0 },
      reachable: true,
    })

    expect(result2.shoulder.x).toBeGreaterThanOrEqual(-Math.PI / 2)
  })

  it('should clamp shoulder Z rotation to [-PI, PI]', () => {
    const result = clampArmRotation({
      shoulder: { x: 0, y: 0, z: 4 }, // > PI
      elbow: { x: 0, y: 0, z: 0 },
      reachable: true,
    })

    expect(result.shoulder.z).toBeLessThanOrEqual(Math.PI)
  })

  it('should clamp elbow bend to prevent hyperextension', () => {
    // Elbow should not bend beyond ~150° (2.6 rad) in any axis
    const result = clampArmRotation({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: -3.5, y: 0.5, z: 0 }, // extreme values
      reachable: true,
    })

    // Each axis should be clamped
    expect(Math.abs(result.elbow.x)).toBeLessThanOrEqual(2.6 + 0.01)
    expect(Math.abs(result.elbow.y)).toBeLessThanOrEqual(2.6 + 0.01)
  })
})
