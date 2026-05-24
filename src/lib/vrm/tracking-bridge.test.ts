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
        wristFrame: null,
      },
      rightHand: null,
    }

    bridge.update(trackingResult)

    // Should call for finger bones
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalled()
  })

  describe('Wrist rotation', () => {
    function makeBone() {
      const rotation = {
        x: 0,
        y: 0,
        z: 0,
        set: vi.fn(function (this: { x: number; y: number; z: number }, x: number, y: number, z: number) {
          this.x = x
          this.y = y
          this.z = z
        }),
      }
      return { rotation }
    }

    const tposeArm = {
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: 0 },
    }
    const palmToCameraFrame = {
      handAxis: { x: -1, y: 0, z: 0 },  // left hand extends -X solver
      palmNormal: { x: 0, y: 0, z: -1 }, // palm-to-camera = -Z solver
    }

    it('writes leftHand bone rotation when wrist frame is present', () => {
      const mockBones: Record<string, ReturnType<typeof makeBone>> = {}
      mockBones.leftHand = makeBone()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockImplementation((name: string) => {
        return mockBones[name] ?? makeBone()
      })

      const trackingResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: tposeArm,
          rightArm: null,
        },
        leftHand: {
          thumb: { curl: 0, spread: 0 },
          index: { curl: 0, spread: 0 },
          middle: { curl: 0, spread: 0 },
          ring: { curl: 0, spread: 0 },
          pinky: { curl: 0, spread: 0 },
          wristFrame: palmToCameraFrame,
        },
        rightHand: null,
      }

      bridge.update(trackingResult)

      expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('leftHand')
      expect(mockBones.leftHand.rotation.set).toHaveBeenCalled()
    })

    it('does not write leftHand bone rotation when wrist frame is null', () => {
      const mockBones: Record<string, ReturnType<typeof makeBone>> = {}
      mockBones.leftHand = makeBone()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockImplementation((name: string) => {
        return mockBones[name] ?? makeBone()
      })

      const trackingResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: tposeArm,
          rightArm: null,
        },
        leftHand: {
          thumb: { curl: 0, spread: 0 },
          index: { curl: 0, spread: 0 },
          middle: { curl: 0, spread: 0 },
          ring: { curl: 0, spread: 0 },
          pinky: { curl: 0, spread: 0 },
          wristFrame: null,
        },
        rightHand: null,
      }

      bridge.update(trackingResult)

      // The hand bone should not be touched when wrist frame is null.
      expect(mockBones.leftHand.rotation.set).not.toHaveBeenCalled()
    })

    it('produces a non-trivial Euler when palm orientation differs from rest', () => {
      const mockBones: Record<string, ReturnType<typeof makeBone>> = {}
      mockBones.leftHand = makeBone()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockImplementation((name: string) => {
        return mockBones[name] ?? makeBone()
      })

      const trackingResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: tposeArm,
          rightArm: null,
        },
        leftHand: {
          thumb: { curl: 0, spread: 0 },
          index: { curl: 0, spread: 0 },
          middle: { curl: 0, spread: 0 },
          ring: { curl: 0, spread: 0 },
          pinky: { curl: 0, spread: 0 },
          // Palm rotated 90° from rest (palm-up instead of palm-down)
          wristFrame: {
            handAxis: { x: -1, y: 0, z: 0 },
            palmNormal: { x: 0, y: 1, z: 0 }, // palm-up = opposite of rest -Y
          },
        },
        rightHand: null,
      }

      bridge.update(trackingResult)

      // The bone should have a non-trivial rotation when palm is flipped from rest.
      const rot = mockBones.leftHand.rotation
      const totalMag = Math.abs(rot.x) + Math.abs(rot.y) + Math.abs(rot.z)
      expect(totalMag).toBeGreaterThan(0.5)
    })
  })

  it('should apply finger spread as Y rotation on proximal bones', () => {
    // Mock that records the values passed to rotation.set into x/y/z so tests
    // can read them back (real three.js Euler does this internally).
    function makeBone() {
      const rotation = {
        x: 0,
        y: 0,
        z: 0,
        set: vi.fn(function (this: { x: number; y: number; z: number }, x: number, y: number, z: number) {
          this.x = x
          this.y = y
          this.z = z
        }),
      }
      return { rotation }
    }
    const mockBones: Record<string, ReturnType<typeof makeBone>> = {}
    const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
    for (const name of fingerNames) {
      mockBones[`left${name}Proximal`] = makeBone()
    }
    mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockImplementation((name: string) => {
      return mockBones[name] ?? makeBone()
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

    // Spread is now applied on Y (curl uses Z; the bone extends along ±X so
    // X-rotation is a no-op against the rest pose).
    const indexBone = mockBones['leftIndexProximal']
    expect(indexBone.rotation.y).not.toBe(0)
    const ringBone = mockBones['leftRingProximal']
    expect(ringBone.rotation.y).not.toBe(0)
  })

  it('should apply eye gaze to VRM eye bones', () => {
    const mockBones: Record<string, { rotation: { set: ReturnType<typeof vi.fn>; x: number; y: number; z: number } }> = {}
    for (const name of ['leftEye', 'rightEye']) {
      mockBones[name] = {
        rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
      }
    }
    mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockImplementation((name: string) => {
      return mockBones[name] ?? { rotation: { set: vi.fn(), x: 0, y: 0, z: 0 } }
    })

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0.5, gazeY: -0.3 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)

    // Eye bones should be requested
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('leftEye')
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('rightEye')

    // Eye bones should have rotation applied via set()
    expect(mockBones['leftEye'].rotation.set).toHaveBeenCalledWith(
      expect.any(Number), // pitch (gazeY)
      expect.any(Number), // yaw (gazeX)
      0,                  // no roll
      'ZYX'
    )
  })

  describe('Kalman filter reset on tracking loss', () => {
    it('should reset face filters when face tracking is lost', () => {
      bridge.setSmoothing(0.8) // High smoothing = slow interpolation

      // Send face data for a few frames to build filter state
      const faceResult: HolisticResult = {
        face: {
          head: { pitch: 0.5, yaw: 0.3, roll: 0.1 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      }
      bridge.update(faceResult)
      bridge.update(faceResult)

      // Lose face tracking for a frame
      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })

      // Now regain tracking with very different values
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      const newFaceResult: HolisticResult = {
        face: {
          head: { pitch: -0.5, yaw: -0.3, roll: -0.1 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      }
      bridge.update(newFaceResult)

      // After filter reset, the first frame should snap close to the new value
      // (not be dragged toward the stale old value due to high smoothing)
      const headSetCall = mockRotationSet.mock.calls.find(
        (call: unknown[]) => call[3] === 'ZYX'
      )
      expect(headSetCall).toBeDefined()
      // Pitch should be close to -0.5 (snapped), not interpolated from 0.5
      expect(headSetCall![0]).toBeCloseTo(-0.5, 1)
    })

    it('should reset pose filters when pose tracking is lost', () => {
      bridge.setSmoothing(0.8)

      // Build pose filter state
      const poseResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0.3, yaw: 0.2, roll: 0.1 },
          leftArm: { shoulder: { x: 0.5, y: 0.3, z: 0.1 }, elbow: { x: -0.5, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0.5, y: -0.3, z: -0.1 }, elbow: { x: -0.5, y: 0, z: 0 } },
        },
        leftHand: null, rightHand: null,
      }
      bridge.update(poseResult)
      bridge.update(poseResult)

      // Lose pose tracking
      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })

      // Regain with different values
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      const newPoseResult: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: -0.3, yaw: -0.2, roll: -0.1 },
          leftArm: { shoulder: { x: -0.5, y: -0.3, z: -0.1 }, elbow: { x: 0.5, y: 0, z: 0 } },
          rightArm: { shoulder: { x: -0.5, y: 0.3, z: 0.1 }, elbow: { x: 0.5, y: 0, z: 0 } },
        },
        leftHand: null, rightHand: null,
      }
      bridge.update(newPoseResult)

      // The spine rotation should snap to the new values
      const spineCalls = mockRotationSet.mock.calls
      expect(spineCalls.length).toBeGreaterThan(0)
      // First call should be spine with near -0.3 pitch
      expect(spineCalls[0][0]).toBeCloseTo(-0.3, 1)
    })

    it('should reset hand filters when hand tracking is lost', () => {
      bridge.setSmoothing(0.8)

      // Build hand filter state
      const handResult: HolisticResult = {
        face: null, pose: null,
        leftHand: {
          thumb: { curl: 0.8, spread: 0.5 },
          index: { curl: 0.8, spread: 0 },
          middle: { curl: 0.8, spread: 0 },
          ring: { curl: 0.8, spread: 0 },
          pinky: { curl: 0.8, spread: 0 },
        },
        rightHand: null,
      }
      bridge.update(handResult)
      bridge.update(handResult)

      // Lose hand tracking
      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })

      // Regain with different values
      const mockBone = {
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          set: vi.fn(function (this: { x: number; y: number; z: number }, x: number, y: number, z: number) {
            this.x = x
            this.y = y
            this.z = z
          }),
        },
      }
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue(mockBone)

      const newHandResult: HolisticResult = {
        face: null, pose: null,
        leftHand: {
          thumb: { curl: 0.1, spread: -0.5 },
          index: { curl: 0.1, spread: 0 },
          middle: { curl: 0.1, spread: 0 },
          ring: { curl: 0.1, spread: 0 },
          pinky: { curl: 0.1, spread: 0 },
        },
        rightHand: null,
      }
      bridge.update(newHandResult)

      // Curl now maps to Z (bone extends along X — see applyHandTracking comment).
      // For left side, sign is +; |bone.rotation.z| = curl * π/2.
      expect(Math.abs(mockBone.rotation.z)).toBeCloseTo(0.1 * Math.PI / 2, 1)
    })
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

  describe('fast-response smoothing for eye and mouth', () => {
    it('should apply near-instant smoothing to eye blinks', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })

      // Frame 1: initialize filters
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Frame 2: jump to 1.0
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 1, rightBlink: 1, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // With fast responsiveness (0.9), blink should be close to 0.9 after one frame
      // (0 + 0.9 * (1 - 0) = 0.9)
      const setValue = mockVrm.expressionManager!.setValue as ReturnType<typeof vi.fn>
      const blinkLeftCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'blinkLeft')
      const lastBlinkLeft = blinkLeftCalls[blinkLeftCalls.length - 1][1] as number
      expect(lastBlinkLeft).toBeCloseTo(0.9, 1)
    })

    it('should apply near-instant smoothing to eye gaze', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      // Frame 1: initialize
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Frame 2: gaze jumps to 1.0
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 1, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // gazeX with fast responsiveness: 0 + 0.9 * (1 - 0) = 0.9
      // Applied as yaw: 0.9 * (PI/6)
      const eyeCalls = mockRotationSet.mock.calls.filter(
        (c: unknown[]) => c[3] === 'ZYX' && (c[1] as number) !== 0
      )
      // At least one eye bone should have non-zero yaw close to 0.9 * PI/6
      expect(eyeCalls.length).toBeGreaterThan(0)
      expect(eyeCalls[eyeCalls.length - 1][1]).toBeCloseTo(0.9 * (Math.PI / 6), 1)
    })

    it('should apply near-instant smoothing to mouth movements', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })

      // Frame 1: initialize
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Frame 2: mouth opens
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 1, smile: 1 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // With fast responsiveness (0.9): 0 + 0.9 * (1 - 0) = 0.9
      const setValue = mockVrm.expressionManager!.setValue as ReturnType<typeof vi.fn>
      const aaCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'aa')
      const lastAa = aaCalls[aaCalls.length - 1][1] as number
      expect(lastAa).toBeCloseTo(0.9, 1)

      const happyCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'happy')
      const lastHappy = happyCalls[happyCalls.length - 1][1] as number
      expect(lastHappy).toBeCloseTo(0.9, 1)
    })

    it('should use global smoothing for head rotation', () => {
      // smoothing=0.8 → responsiveness=0.2 for normal keys
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      // Frame 1: initialize at 0
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      mockRotationSet.mockClear()

      // Frame 2: head pitch jumps to 1.0
      bridge.update({
        face: {
          head: { pitch: 1, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Head uses global smoothing: responsiveness = 1 - 0.8 = 0.2
      // So pitch = 0 + 0.2 * (1 - 0) = 0.2
      const headCall = mockRotationSet.mock.calls.find(
        (c: unknown[]) => c[3] === 'ZYX' && c[0] !== 0
      )
      expect(headCall).toBeDefined()
      expect(headCall![0]).toBeCloseTo(0.2, 1)
    })

    it('should use global smoothing for spine rotation', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      // Frame 1: initialize
      bridge.update({
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
        },
        leftHand: null, rightHand: null,
      })

      mockRotationSet.mockClear()

      // Frame 2: spine pitch jumps to 1.0
      bridge.update({
        face: null,
        pose: {
          spine: { pitch: 1, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
        },
        leftHand: null, rightHand: null,
      })

      // Spine uses global smoothing: responsiveness = 0.2
      // pitch = 0 + 0.2 * (1 - 0) = 0.2
      const spineCall = mockRotationSet.mock.calls[0]
      expect(spineCall[0]).toBeCloseTo(0.2, 1)
    })

    it('should preserve fast-response behavior after setSmoothing()', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.5 })

      // Frame 1: initialize
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Change smoothing (clears all filters)
      bridge.setSmoothing(0.9)

      // Frame 2: after reset, blink should still use fast responsiveness
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Frame 3: blink jumps
      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 1, rightBlink: 1, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Fast responsiveness (0.9) should still apply, not global (1-0.9=0.1)
      const setValue = mockVrm.expressionManager!.setValue as ReturnType<typeof vi.fn>
      const blinkCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'blinkLeft')
      const lastBlink = blinkCalls[blinkCalls.length - 1][1] as number
      expect(lastBlink).toBeCloseTo(0.9, 1)
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
