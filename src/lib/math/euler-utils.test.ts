import { describe, it, expect } from 'vitest'
import { quaternionToEuler, clampAngle, lerpAngle } from './euler-utils'

describe('EulerUtils', () => {
  it('should convert identity quaternion to zero rotation', () => {
    // Identity quaternion (no rotation)
    const quaternion = { x: 0, y: 0, z: 0, w: 1 }

    const euler = quaternionToEuler(quaternion)

    expect(euler.x).toBeCloseTo(0)
    expect(euler.y).toBeCloseTo(0)
    expect(euler.z).toBeCloseTo(0)
  })

  it('should convert 90-degree Y rotation quaternion correctly', () => {
    // 90 degrees around Y axis: quaternion = (0, sin(45°), 0, cos(45°))
    const angle = Math.PI / 2
    const quaternion = {
      x: 0,
      y: Math.sin(angle / 2),
      z: 0,
      w: Math.cos(angle / 2),
    }

    const euler = quaternionToEuler(quaternion)

    expect(euler.x).toBeCloseTo(0)
    expect(euler.y).toBeCloseTo(Math.PI / 2)
    expect(euler.z).toBeCloseTo(0)
  })

  it('should clamp angle exceeding max to max', () => {
    const clamped = clampAngle(2.0, -1.0, 1.0)
    expect(clamped).toBe(1.0)
  })

  it('should interpolate angles at midpoint', () => {
    const result = lerpAngle(0, Math.PI, 0.5)
    expect(result).toBeCloseTo(Math.PI / 2)
  })
})
