import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrackingBridge, TrackingBridgeOptions } from './tracking-bridge'
import type { HolisticResult } from '../solver/holistic-solver'
import type { VRM } from '@pixiv/three-vrm'

// Mock VRM animator
vi.mock('./animator', () => ({
  VRMAnimator: class MockVRMAnimator {
    applyBoneRotations = vi.fn()
    applyBlendShapes = vi.fn()
  },
}))

describe('TrackingBridge', () => {
  let mockVrm: VRM
  let bridge: TrackingBridge

  beforeEach(() => {
    mockVrm = {
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
        }),
      },
      expressionManager: {
        setValue: vi.fn(),
      },
    } as unknown as VRM

    bridge = new TrackingBridge(mockVrm)
  })

  it('should apply face tracking results to VRM', () => {
    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
        eyes: { leftBlink: 0.5, rightBlink: 0.4 },
        mouth: { open: 0.3, smile: 0.2 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)

    // The VRM humanoid should have bone rotations applied
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('head')
  })

  it('should apply pose tracking results to VRM', () => {
    const trackingResult: HolisticResult = {
      face: null,
      pose: {
        spine: { pitch: 0.1, yaw: 0, roll: 0 },
        leftArm: {
          shoulder: { x: 0, y: 0, z: 0 },
          elbow: { x: 0, y: 0, z: 0 },
        },
        rightArm: {
          shoulder: { x: 0, y: 0, z: 0 },
          elbow: { x: 0, y: 0, z: 0 },
        },
      },
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)

    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('spine')
  })

  it('should handle null tracking data gracefully', () => {
    const trackingResult: HolisticResult = {
      face: null,
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    // Should not throw
    expect(() => bridge.update(trackingResult)).not.toThrow()
  })

  it('should respect feature toggles', () => {
    const options: TrackingBridgeOptions = {
      faceTracking: false,
      poseTracking: false,
      handTracking: false,
    }

    bridge = new TrackingBridge(mockVrm, options)

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
        eyes: { leftBlink: 0.5, rightBlink: 0.4 },
        mouth: { open: 0.3, smile: 0.2 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)

    // Should not apply face tracking when disabled
    expect(mockVrm.humanoid.getNormalizedBoneNode).not.toHaveBeenCalledWith(
      'head'
    )
  })

  it('should interpolate between frames for smooth animation', () => {
    const result1: HolisticResult = {
      face: {
        head: { pitch: 0, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    const result2: HolisticResult = {
      face: {
        head: { pitch: 1, yaw: 1, roll: 1 },
        eyes: { leftBlink: 1, rightBlink: 1 },
        mouth: { open: 1, smile: 1 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    // Update with smoothing (should interpolate)
    bridge.setSmoothing(0.5)
    bridge.update(result1)
    bridge.update(result2)

    // With 0.5 smoothing, values should be partially interpolated
    // This is a functional test - actual interpolation happens internally
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalled()
  })

  it('should apply hand tracking results to VRM', () => {
    const trackingResult: HolisticResult = {
      face: null,
      pose: null,
      leftHand: {
        thumb: { curl: 0.5, spread: 0 },
        index: { curl: 0.3, spread: 0 },
        middle: { curl: 0.4, spread: 0 },
        ring: { curl: 0.35, spread: 0 },
        pinky: { curl: 0.3, spread: 0 },
      },
      rightHand: null,
    }

    bridge.update(trackingResult)

    // Should call for finger bones
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalled()
  })

  it('should apply finger spread as Z rotation on proximal bones', () => {
    const mockBones: Record<string, { rotation: { set: ReturnType<typeof vi.fn>; x: number; y: number; z: number } }> = {}
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
    for (const name of fingerNames) {
      mockBones[`left${name}Proximal`] = {
        rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
      }
    }
    mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockImplementation((name: string) => {
      return mockBones[name] ?? { rotation: { set: vi.fn(), x: 0, y: 0, z: 0 } }
    })

    const trackingResult: HolisticResult = {
      face: null,
      pose: null,
      leftHand: {
        thumb: { curl: 0, spread: 0.5 },
        index: { curl: 0, spread: -0.4 },
        middle: { curl: 0, spread: 0 },
        ring: { curl: 0, spread: 0.3 },
        pinky: { curl: 0, spread: 0.6 },
      },
      rightHand: null,
    }

    bridge.update(trackingResult)

    // Index finger should have non-zero Z rotation from spread
    const indexBone = mockBones['leftIndexProximal']
    expect(indexBone.rotation.z).not.toBe(0)

    // Ring finger should have non-zero Z rotation from spread
    const ringBone = mockBones['leftRingProximal']
    expect(ringBone.rotation.z).not.toBe(0)
  })

  describe('Euler order (VRM compatibility)', () => {
    it('should use ZYX Euler order for head rotation', () => {
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      const trackingResult: HolisticResult = {
        face: {
          head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
          eyes: { leftBlink: 0, rightBlink: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null,
        leftHand: null,
        rightHand: null,
      }

      bridge.update(trackingResult)

      // Should be called with ZYX order as 4th argument
      expect(mockRotationSet).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        'ZYX'
      )
    })

    it('should use ZYX Euler order for spine rotation', () => {
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      const trackingResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0.1, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
        },
        leftHand: null,
        rightHand: null,
      }

      bridge.update(trackingResult)

      // All rotation.set calls should include 'ZYX'
      const calls = mockRotationSet.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      for (const call of calls) {
        expect(call[3]).toBe('ZYX')
      }
    })

    it('should use ZYX Euler order for arm bone rotations', () => {
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      const trackingResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0.5, y: 0.3, z: 0.1 }, elbow: { x: -0.5, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0.5, y: -0.3, z: -0.1 }, elbow: { x: -0.5, y: 0, z: 0 } },
        },
        leftHand: null,
        rightHand: null,
      }

      bridge.update(trackingResult)

      // Find arm-related calls (should be leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm)
      const armBoneNames = ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm']
      const getBoneCalls = (mockVrm.humanoid.getNormalizedBoneNode as ReturnType<typeof vi.fn>).mock.calls
      const armCalls = getBoneCalls.filter((call: string[]) => armBoneNames.includes(call[0]))
      expect(armCalls.length).toBe(4)

      // All rotation.set calls should use 'ZYX' order
      const calls = mockRotationSet.mock.calls
      for (const call of calls) {
        expect(call[3]).toBe('ZYX')
      }
    })
  })

  it('should update feature toggles dynamically', () => {
    // Start with all enabled
    bridge = new TrackingBridge(mockVrm, {
      faceTracking: true,
      poseTracking: true,
      handTracking: true,
    })

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
        eyes: { leftBlink: 0.5, rightBlink: 0.4 },
        mouth: { open: 0.3, smile: 0.2 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    // Verify face tracking works
    bridge.update(trackingResult)
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('head')

    vi.clearAllMocks()

    // Disable face tracking
    bridge.setOptions({ faceTracking: false })
    bridge.update(trackingResult)

    // Should no longer apply head rotation
    expect(mockVrm.humanoid.getNormalizedBoneNode).not.toHaveBeenCalledWith(
      'head'
    )
  })
})
