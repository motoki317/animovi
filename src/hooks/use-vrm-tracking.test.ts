/**
 * Tests for useVRMTracking hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVRMTracking } from './use-vrm-tracking'

// Mock MediaPipe
vi.mock('../lib/mediapipe/tracker', () => ({
  MediaPipeTracker: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
    detectLandmarks: vi.fn().mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      poseLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      leftHandLandmarks: [],
      rightHandLandmarks: [],
    }),
    dispose: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock TrackingBridge
vi.mock('../lib/vrm/tracking-bridge', () => ({
  TrackingBridge: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    setSmoothing: vi.fn(),
    dispose: vi.fn(),
  })),
}))

// Mock HolisticSolver
vi.mock('../lib/solver/holistic-solver', () => ({
  solveHolistic: vi.fn().mockReturnValue({
    face: {
      head: { pitch: 0, yaw: 0, roll: 0 },
      eyes: { leftBlink: 0, rightBlink: 0 },
      mouth: { open: 0, smile: 0 },
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
  }),
}))

describe('useVRMTracking', () => {
  const mockVRM = {
    humanoid: {
      getNormalizedBoneNode: vi.fn(),
    },
    expressionManager: {
      setValue: vi.fn(),
    },
  }

  const mockVideoRef = {
    current: {
      readyState: 4,
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return expected interface when enabled and VRM is provided', () => {
    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        enabled: true,
      })
    )

    // Hook should return the expected interface
    expect(result.current).toHaveProperty('isTracking')
    expect(result.current).toHaveProperty('isInitializing')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('start')
    expect(result.current).toHaveProperty('stop')
    expect(typeof result.current.start).toBe('function')
    expect(typeof result.current.stop).toBe('function')
  })

  it('should not initialize when disabled', () => {
    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        enabled: false,
      })
    )

    expect(result.current.isTracking).toBe(false)
    expect(result.current.isInitializing).toBe(false)
  })

  it('should not initialize when VRM is null', () => {
    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: null,
        videoRef: mockVideoRef,
        enabled: true,
      })
    )

    expect(result.current.isTracking).toBe(false)
  })
})
