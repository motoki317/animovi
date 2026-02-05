import { describe, it, expect } from 'vitest'
import { solveTwoBoneIK, calculateArmLengths, type Vector3 } from './two-bone-ik'

describe('Two-Bone IK Solver', () => {
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
