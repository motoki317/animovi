import { describe, it, expect } from 'vitest'
import { quaternionToEuler } from './euler-utils'

describe('EulerUtils', () => {
  it('should convert identity quaternion to zero rotation', () => {
    // Identity quaternion (no rotation)
    const quaternion = { x: 0, y: 0, z: 0, w: 1 }

    const euler = quaternionToEuler(quaternion)

    expect(euler.x).toBeCloseTo(0)
    expect(euler.y).toBeCloseTo(0)
    expect(euler.z).toBeCloseTo(0)
  })
})
