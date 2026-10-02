import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { TrackingBridge, TrackingBridgeOptions } from './tracking-bridge'
import type { HolisticResult } from '../solver/holistic-solver'
import type { HandResult } from '../solver/hand-solver'
import type { VRM } from '@pixiv/three-vrm'

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
        eyes: { leftBlink: 0.5, rightBlink: 0.4, gazeX: 0, gazeY: 0 },
        mouth: { open: 0.3, smile: 0.2 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)

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
        eyes: { leftBlink: 0.5, rightBlink: 0.4, gazeX: 0, gazeY: 0 },
        mouth: { open: 0.3, smile: 0.2 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)

    expect(mockVrm.humanoid.getNormalizedBoneNode).not.toHaveBeenCalledWith(
      'head'
    )
  })

  it('should interpolate between frames for smooth animation', () => {
    const result1: HolisticResult = {
      face: {
        head: { pitch: 0, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    const result2: HolisticResult = {
      face: {
        head: { pitch: 1, yaw: 1, roll: 1 },
        eyes: { leftBlink: 1, rightBlink: 1, gazeX: 0, gazeY: 0 },
        mouth: { open: 1, smile: 1 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.setSmoothing(0.5)
    bridge.update(result1)
    bridge.update(result2)

    // Responsiveness 0.5: 0 + 0.5 × (1 − 0) = 0.5
    expect(bridge.getAppliedRotations().head.applied.x).toBeCloseTo(0.5)
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

    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('leftIndexProximal')
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
      handAxis: { x: -1, y: 0, z: 0 }, // The left hand extends toward solver -X.
      palmNormal: { x: 0, y: 0, z: -1 }, // The palm faces the camera.
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
          // Palm up: 180° about the hand axis from the palm-down rest.
          wristFrame: {
            handAxis: { x: -1, y: 0, z: 0 },
            palmNormal: { x: 0, y: 1, z: 0 },
          },
        },
        rightHand: null,
      }

      bridge.update(trackingResult)

      const rot = mockBones.leftHand.rotation
      const totalMag = Math.abs(rot.x) + Math.abs(rot.y) + Math.abs(rot.z)
      expect(totalMag).toBeGreaterThan(0.5)
    })
  })

  it('should apply finger spread as Y rotation on proximal bones', () => {
    // Like a three.js Euler, the mock stores the set() arguments in x, y, and z.
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
        wristFrame: null,
      },
      rightHand: null,
    }

    bridge.update(trackingResult)

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

    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('leftEye')
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('rightEye')

    expect(mockBones['leftEye'].rotation.set).toHaveBeenCalledWith(
      expect.any(Number), // pitch (gazeY)
      expect.any(Number), // yaw (gazeX)
      0,                  // no roll
      'ZYX'
    )
  })

  // rotateVRM0 turns a VRM 0.x scene by π about Y, so both versions face world +Z.
  // A VRM 0.x model faces -Z in its own frame.
  it.each([
    { metaVersion: '0', sceneYaw: Math.PI, modelForward: new THREE.Vector3(0, 0, -1) },
    { metaVersion: '1', sceneYaw: 0, modelForward: new THREE.Vector3(0, 0, 1) },
  ])('turns the eyes up in world space for gazeY > 0 on VRM $metaVersion', ({ metaVersion, sceneYaw, modelForward }) => {
    const scene = new THREE.Object3D()
    scene.rotation.y = sceneYaw
    const leftEye = new THREE.Object3D()
    scene.add(leftEye)
    const vrm = {
      meta: { metaVersion },
      humanoid: { getNormalizedBoneNode: (name: string) => (name === 'leftEye' ? leftEye : null) },
    } as unknown as VRM

    new TrackingBridge(vrm).update({
      face: {
        head: { pitch: 0, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0.75 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    })

    scene.updateMatrixWorld()
    const gaze = modelForward.clone().applyQuaternion(leftEye.getWorldQuaternion(new THREE.Quaternion()))
    expect(gaze.z).toBeGreaterThan(0)
    expect(gaze.y).toBeGreaterThan(0)
  })

  // face-solver gives positive pitch when the forehead is farther from the
  // camera than the chin, so the user tilts the head back and looks up.
  it.each([
    { metaVersion: '0', sceneYaw: Math.PI, modelForward: new THREE.Vector3(0, 0, -1) },
    { metaVersion: '1', sceneYaw: 0, modelForward: new THREE.Vector3(0, 0, 1) },
  ])('turns the head up in world space for pitch > 0 on VRM $metaVersion', ({ metaVersion, sceneYaw, modelForward }) => {
    const scene = new THREE.Object3D()
    scene.rotation.y = sceneYaw
    const head = new THREE.Object3D()
    scene.add(head)
    const vrm = {
      meta: { metaVersion },
      humanoid: { getNormalizedBoneNode: (name: string) => (name === 'head' ? head : null) },
    } as unknown as VRM

    new TrackingBridge(vrm).update({
      face: {
        head: { pitch: 0.4, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    })

    scene.updateMatrixWorld()
    const facing = modelForward.clone().applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()))
    expect(facing.z).toBeGreaterThan(0)
    expect(facing.y).toBeCloseTo(Math.sin(0.4))
  })

  describe('filter reset on tracking loss', () => {
    it('should reset face filters when face tracking is lost', () => {
      bridge.setSmoothing(0.8) // Slow filters make a missed reset visible.

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

      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })

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

      // A reset filter starts at -0.5. A stale filter returns 0.5 + 0.2 × (-1) = 0.3.
      const headSetCall = mockRotationSet.mock.calls.find(
        (call: unknown[]) => call[3] === 'ZYX'
      )
      expect(headSetCall).toBeDefined()
      expect(headSetCall![0]).toBeCloseTo(-0.5, 1)
    })

    it('resets the spine filters when pose tracking is lost', () => {
      bridge.setSmoothing(0.8)

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

      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })

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

      const spineCalls = mockRotationSet.mock.calls
      expect(spineCalls.length).toBeGreaterThan(0)
      // update() writes the spine first.
      expect(spineCalls[0][0]).toBeCloseTo(-0.3, 1)
    })

    it('should reset hand filters when hand tracking is lost', () => {
      bridge.setSmoothing(0.8)

      const handResult: HolisticResult = {
        face: null, pose: null,
        leftHand: {
          thumb: { curl: 0.8, spread: 0.5 },
          index: { curl: 0.8, spread: 0 },
          middle: { curl: 0.8, spread: 0 },
          ring: { curl: 0.8, spread: 0 },
          pinky: { curl: 0.8, spread: 0 },
          wristFrame: null,
        },
        rightHand: null,
      }
      bridge.update(handResult)
      bridge.update(handResult)

      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })

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
          wristFrame: null,
        },
        rightHand: null,
      }
      bridge.update(newHandResult)

      // The last write is a distal joint, which bends 0.4π per unit of curl.
      expect(mockBone.rotation.z).toBeCloseTo(0.1 * Math.PI * 0.4)
    })

    it('keeps arm filters when a hand is lost', () => {
      bridge.setSmoothing(0.8)
      const openHand: HandResult = {
        thumb: { curl: 0, spread: 0 },
        index: { curl: 0, spread: 0 },
        middle: { curl: 0, spread: 0 },
        ring: { curl: 0, spread: 0 },
        pinky: { curl: 0, spread: 0 },
        wristFrame: null,
      }
      const frame = (roll: number, leftHand: HandResult | null): HolisticResult => ({
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0, y: 0, z: roll }, elbow: { x: 0, y: 0, z: 0 } },
          rightArm: null,
        },
        leftHand,
        rightHand: null,
      })

      bridge.update(frame(0, openHand))
      bridge.update(frame(0, null))
      bridge.update(frame(1, null))

      // A kept filter moves 0 → 0.2 at responsiveness 0.2. A reset filter jumps to 1.
      expect(bridge.getAppliedRotations().leftUpperArm.applied.z).toBeCloseTo(0.2)
    })

    it('eases the arms down and back when one pose frame drops', () => {
      bridge.setSmoothing(0.8)
      const armsOut: HolisticResult = {
        face: null,
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
        },
        leftHand: null, rightHand: null,
      }
      const leftRoll = () => bridge.getAppliedRotations().leftUpperArm.applied.z
      const armsDownRoll = Math.PI / 2.5

      bridge.update(armsOut)
      bridge.update({ face: null, pose: null, leftHand: null, rightHand: null })
      // A kept filter moves a fifth of the way. A reset filter jumps to the default.
      expect(leftRoll()).toBeCloseTo(0.2 * armsDownRoll)

      bridge.update(armsOut)
      expect(leftRoll()).toBeCloseTo(0.8 * 0.2 * armsDownRoll)
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
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null,
        leftHand: null,
        rightHand: null,
      }

      bridge.update(trackingResult)

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

      const armBoneNames = ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm']
      const getBoneCalls = (mockVrm.humanoid.getNormalizedBoneNode as ReturnType<typeof vi.fn>).mock.calls
      const armCalls = getBoneCalls.filter((call: string[]) => armBoneNames.includes(call[0]))
      expect(armCalls.length).toBe(4)

      const calls = mockRotationSet.mock.calls
      for (const call of calls) {
        expect(call[3]).toBe('ZYX')
      }
    })
  })

  describe('fast-response smoothing for eye and mouth', () => {
    it('should apply near-instant smoothing to eye blinks', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 1, rightBlink: 1, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Fast keys use responsiveness 0.9: 0 + 0.9 × (1 − 0) = 0.9
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

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 1, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Smoothed gazeX is 0.9, and the yaw is 0.9 × π/6.
      const eyeCalls = mockRotationSet.mock.calls.filter(
        (c: unknown[]) => c[3] === 'ZYX' && (c[1] as number) !== 0
      )
      expect(eyeCalls.length).toBeGreaterThan(0)
      expect(eyeCalls[eyeCalls.length - 1][1]).toBeCloseTo(0.9 * (Math.PI / 6), 1)
    })

    it('should apply near-instant smoothing to mouth movements', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 1, smile: 1 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Fast keys use responsiveness 0.9: 0 + 0.9 × (1 − 0) = 0.9
      const setValue = mockVrm.expressionManager!.setValue as ReturnType<typeof vi.fn>
      const aaCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'aa')
      const lastAa = aaCalls[aaCalls.length - 1][1] as number
      expect(lastAa).toBeCloseTo(0.9, 1)

      const happyCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'happy')
      const lastHappy = happyCalls[happyCalls.length - 1][1] as number
      expect(lastHappy).toBeCloseTo(0.9, 1)
    })

    it('should use global smoothing for head rotation', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.8 })
      const mockRotationSet = vi.fn()
      mockVrm.humanoid.getNormalizedBoneNode = vi.fn().mockReturnValue({
        rotation: { set: mockRotationSet, x: 0, y: 0, z: 0 },
      })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      mockRotationSet.mockClear()

      bridge.update({
        face: {
          head: { pitch: 1, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // The head uses responsiveness 1 − 0.8 = 0.2: 0 + 0.2 × (1 − 0) = 0.2
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

      bridge.update({
        face: null,
        pose: {
          spine: { pitch: 1, yaw: 0, roll: 0 },
          leftArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
          rightArm: { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 } },
        },
        leftHand: null, rightHand: null,
      })

      // The spine uses responsiveness 1 − 0.8 = 0.2: 0 + 0.2 × (1 − 0) = 0.2
      const spineCall = mockRotationSet.mock.calls[0]
      expect(spineCall[0]).toBeCloseTo(0.2, 1)
    })

    it('should preserve fast-response behavior after setSmoothing()', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.5 })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // The blink filters exist before this call, so they must stay fast.
      bridge.setSmoothing(0.9)

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      bridge.update({
        face: {
          head: { pitch: 0, yaw: 0, roll: 0 },
          eyes: { leftBlink: 1, rightBlink: 1, gazeX: 0, gazeY: 0 },
          mouth: { open: 0, smile: 0 },
        },
        pose: null, leftHand: null, rightHand: null,
      })

      // Fast keys keep responsiveness 0.9. The global value is 1 − 0.9 = 0.1.
      const setValue = mockVrm.expressionManager!.setValue as ReturnType<typeof vi.fn>
      const blinkCalls = setValue.mock.calls.filter((c: unknown[]) => c[0] === 'blinkLeft')
      const lastBlink = blinkCalls[blinkCalls.length - 1][1] as number
      expect(lastBlink).toBeCloseTo(0.9, 1)
    })
  })

  describe('smoothing changes', () => {
    const faceWithPitch = (pitch: number): HolisticResult => ({
      face: {
        head: { pitch, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null, leftHand: null, rightHand: null,
    })
    const headPitch = (b: TrackingBridge) => b.getAppliedRotations().head.applied.x

    // Persisted settings can hold 1, and responsiveness 1 − 1 = 0 froze the avatar.
    it('still follows the input at smoothing 1', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 1 })

      bridge.update(faceWithPitch(0))
      bridge.update(faceWithPitch(1))

      expect(headPitch(bridge)).toBeCloseTo(0.1)
    })

    it('keeps the smoothed state when setSmoothing() changes the value', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0.75 })

      bridge.update(faceWithPitch(0))
      bridge.setSmoothing(0.5)
      bridge.update(faceWithPitch(1))

      // A restarted filter would return the raw 1.
      expect(headPitch(bridge)).toBeCloseTo(0.5)
    })

    it('applies a smoothing value passed to setOptions()', () => {
      bridge = new TrackingBridge(mockVrm, { smoothing: 0 })

      bridge.update(faceWithPitch(0))
      bridge.setOptions({ smoothing: 0.75 })
      bridge.update(faceWithPitch(1))

      expect(headPitch(bridge)).toBeCloseTo(0.25)
    })
  })

  it('should update feature toggles dynamically', () => {
    bridge = new TrackingBridge(mockVrm, {
      faceTracking: true,
      poseTracking: true,
      handTracking: true,
    })

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
        eyes: { leftBlink: 0.5, rightBlink: 0.4, gazeX: 0, gazeY: 0 },
        mouth: { open: 0.3, smile: 0.2 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    bridge.update(trackingResult)
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('head')

    vi.clearAllMocks()

    bridge.setOptions({ faceTracking: false })
    bridge.update(trackingResult)

    expect(mockVrm.humanoid.getNormalizedBoneNode).not.toHaveBeenCalledWith(
      'head'
    )
  })
})
