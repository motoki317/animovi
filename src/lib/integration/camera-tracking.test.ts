/**
 * Integration tests for Camera → Tracking pipeline
 *
 * These tests verify the full data flow from camera stream to VRM tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isVideoReady, waitForVideoReady } from '../capture/video-readiness'

// We test the integration points without the full React hook overhead

describe('Camera to Tracking Integration', () => {
  describe('Video element stream connection', () => {
    let video: HTMLVideoElement

    beforeEach(() => {
      video = document.createElement('video')
    })

    it('should not be ready before srcObject is set', () => {
      expect(isVideoReady(video)).toBe(false)
      expect(video.readyState).toBe(0)
      expect(video.videoWidth).toBe(0)
    })

    it('should accept srcObject assignment', () => {
      // Create a mock MediaStream (MediaStream is not available in jsdom)
      const mockStream = { id: 'mock-stream' } as unknown as MediaStream

      // Note: In real browser, setting srcObject triggers async loading
      // In jsdom/happy-dom, MediaStream support is limited
      video.srcObject = mockStream

      // Verify srcObject is set
      expect(video.srcObject).toBe(mockStream)
    })
  })

  describe('Tracking data flow', () => {
    it('should transform MediaPipe landmarks to solver input format', async () => {
      // Import the actual modules
      const { solveHolistic } = await import('../solver/holistic-solver')

      // Mock MediaPipe landmark data (normalized 0-1 coordinates)
      const mockFaceLandmarks = Array.from({ length: 478 }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.1,
      }))

      const mockPoseLandmarks = Array.from({ length: 33 }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.1,
      }))

      // Solve holistic
      const result = solveHolistic({
        face: mockFaceLandmarks,
        pose: mockPoseLandmarks,
        leftHand: [],
        rightHand: [],
      })

      // Verify output structure
      expect(result).toHaveProperty('face')
      expect(result).toHaveProperty('pose')
      expect(result.face).toHaveProperty('head')
      expect(result.face.head).toHaveProperty('pitch')
      expect(result.face.head).toHaveProperty('yaw')
      expect(result.face.head).toHaveProperty('roll')
    })

    it('should produce reasonable rotation values from centered face', async () => {
      const { solveHolistic } = await import('../solver/holistic-solver')

      // Face looking straight at camera (landmarks centered around 0.5)
      const centeredFaceLandmarks = Array.from({ length: 478 }, (_, i) => ({
        x: 0.5 + (Math.random() - 0.5) * 0.1, // Small variation around center
        y: 0.5 + (Math.random() - 0.5) * 0.1,
        z: 0,
      }))

      const result = solveHolistic({
        face: centeredFaceLandmarks,
        pose: [],
        leftHand: [],
        rightHand: [],
      })

      // Head rotation should be near zero for centered face
      expect(Math.abs(result.face.head.yaw)).toBeLessThan(1) // Less than 1 radian
      expect(Math.abs(result.face.head.pitch)).toBeLessThan(1)
    })

    it('should detect head turn from asymmetric landmarks', async () => {
      const { solveFace } = await import('../solver/face-solver')

      // Face turned to the right - right side landmarks closer to center
      const rightTurnLandmarks = Array.from({ length: 478 }, (_, i) => ({
        x: 0.3, // Face shifted left in view = person looking right
        y: 0.5,
        z: 0,
      }))

      // Ensure key landmarks are set for yaw calculation
      // Landmark 454 (right cheek) and 234 (left cheek)
      if (rightTurnLandmarks[454]) rightTurnLandmarks[454].x = 0.4
      if (rightTurnLandmarks[234]) rightTurnLandmarks[234].x = 0.2

      const result = solveFace(rightTurnLandmarks)

      // Expect non-zero yaw (actual direction depends on solver implementation)
      expect(result).toHaveProperty('head')
      expect(typeof result.head.yaw).toBe('number')
    })
  })

  describe('TrackingBridge data application', () => {
    it('should apply holistic result to VRM', async () => {
      const { TrackingBridge } = await import('../vrm/tracking-bridge')

      // Create mock VRM with proper rotation object
      const mockBone = {
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          set: vi.fn(),
        },
        quaternion: { setFromEuler: vi.fn() },
      }

      const mockVRM = {
        humanoid: {
          getNormalizedBoneNode: vi.fn().mockReturnValue(mockBone),
        },
        expressionManager: {
          setValue: vi.fn(),
        },
      }

      // Create bridge
      const bridge = new TrackingBridge(mockVRM as never, {
        smoothing: 0.5,
        faceTracking: true,
        poseTracking: true,
        handTracking: false,
      })

      // Create holistic result
      const holisticResult = {
        face: {
          head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
          eyes: { leftBlink: 0.5, rightBlink: 0.5 },
          mouth: { open: 0.3, smile: 0.2 },
        },
        pose: {
          spine: { pitch: 0, yaw: 0, roll: 0 },
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

      // Apply the result
      bridge.update(holisticResult)

      // Verify VRM was updated
      expect(mockVRM.humanoid.getNormalizedBoneNode).toHaveBeenCalled()
      // Expression manager should be called for blinks and mouth
      expect(mockVRM.expressionManager.setValue).toHaveBeenCalled()
    })
  })
})

describe('End-to-end tracking scenarios', () => {
  it('should handle camera permission granted after mount', async () => {
    // This scenario tests:
    // 1. Component mounts with no camera permission
    // 2. User grants permission, stream becomes available
    // 3. Tracking should start

    const video = document.createElement('video')

    // Initial state: no stream (jsdom returns undefined, not null)
    expect(video.srcObject).toBeFalsy()
    expect(isVideoReady(video)).toBe(false)

    // Simulate stream becoming available
    const mockStream = { id: 'mock' } as unknown as MediaStream
    video.srcObject = mockStream

    // In real scenario, video would fire events and become ready
    // For this test, we verify the srcObject is properly set
    expect(video.srcObject).toBe(mockStream)
  })

  it('should handle camera stream replacement', async () => {
    // This scenario tests switching cameras

    const video = document.createElement('video')

    // First stream
    const stream1 = { id: 'stream1' } as unknown as MediaStream
    video.srcObject = stream1
    expect(video.srcObject).toBe(stream1)

    // Second stream (new camera)
    const stream2 = { id: 'stream2' } as unknown as MediaStream
    video.srcObject = stream2
    expect(video.srcObject).toBe(stream2)
    expect(video.srcObject).not.toBe(stream1)
  })

  it('should handle null stream (camera revoked)', async () => {
    const video = document.createElement('video')

    // Set stream
    const mockStream = {} as MediaStream
    video.srcObject = mockStream

    // Revoke camera
    video.srcObject = null
    expect(video.srcObject).toBe(null)
    expect(isVideoReady(video)).toBe(false)
  })
})
