import { describe, it, expect, vi } from 'vitest'
import { VRMAnimator } from './animator'

// Mock VRM type
interface MockVRM {
  humanoid: {
    getNormalizedBoneNode: (name: string) => { rotation: { x: number; y: number; z: number } } | null
  }
  expressionManager: {
    setValue: (name: string, value: number) => void
  } | null
}

function createMockVRM(): MockVRM {
  const bones: Record<string, { rotation: { x: number; y: number; z: number } }> = {
    head: { rotation: { x: 0, y: 0, z: 0 } },
    spine: { rotation: { x: 0, y: 0, z: 0 } },
    leftUpperArm: { rotation: { x: 0, y: 0, z: 0 } },
    rightUpperArm: { rotation: { x: 0, y: 0, z: 0 } },
  }

  const expressions: Record<string, number> = {}

  return {
    humanoid: {
      getNormalizedBoneNode: (name: string) => bones[name] ?? null,
    },
    expressionManager: {
      setValue: (name: string, value: number) => {
        expressions[name] = value
      },
    },
  }
}

describe('VRMAnimator', () => {
  it('should create animator with VRM model', () => {
    const mockVRM = createMockVRM()
    const animator = new VRMAnimator(mockVRM as never)

    expect(animator).toBeDefined()
  })

  it('should apply head rotation from face result', () => {
    const mockVRM = createMockVRM()
    const animator = new VRMAnimator(mockVRM as never)

    animator.apply({
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0.3 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    })

    const headBone = mockVRM.humanoid.getNormalizedBoneNode('head')
    expect(headBone?.rotation.x).toBeCloseTo(0.1, 1)
    expect(headBone?.rotation.y).toBeCloseTo(0.2, 1)
    expect(headBone?.rotation.z).toBeCloseTo(0.3, 1)
  })

  it('should apply spine rotation from pose result', () => {
    const mockVRM = createMockVRM()
    const animator = new VRMAnimator(mockVRM as never)

    animator.apply({
      face: null,
      pose: {
        spine: { pitch: 0.05, yaw: 0.1, roll: 0 },
        leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
        rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
      },
      leftHand: null,
      rightHand: null,
    })

    const spineBone = mockVRM.humanoid.getNormalizedBoneNode('spine')
    expect(spineBone?.rotation.y).toBeCloseTo(0.1, 1)
  })

  it('should handle null results gracefully', () => {
    const mockVRM = createMockVRM()
    const animator = new VRMAnimator(mockVRM as never)

    // Should not throw
    expect(() => {
      animator.apply({
        face: null,
        pose: null,
        leftHand: null,
        rightHand: null,
      })
    }).not.toThrow()
  })
})
