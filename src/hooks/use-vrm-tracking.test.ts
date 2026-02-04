/**
 * Tests for useVRMTracking hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVRMTracking } from './use-vrm-tracking'

// Mock MediaPipe
vi.mock('../lib/mediapipe/tracker', () => {
  class MockMediaPipeTracker {
    initialize = vi.fn().mockResolvedValue(undefined)
    isReady = vi.fn().mockReturnValue(true)
    detectLandmarks = vi.fn().mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      poseLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      leftHandLandmarks: [],
      rightHandLandmarks: [],
    })
    dispose = vi.fn().mockResolvedValue(undefined)
  }
  return { MediaPipeTracker: MockMediaPipeTracker }
})

// Mock TrackingBridge
vi.mock('../lib/vrm/tracking-bridge', () => {
  class MockTrackingBridge {
    update = vi.fn()
    setSmoothing = vi.fn()
    dispose = vi.fn()
  }
  return { TrackingBridge: MockTrackingBridge }
})

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

  // Mock MediaStream
  const mockStream = {} as MediaStream

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return expected interface when enabled and VRM is provided', () => {
    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        stream: mockStream,
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

  it('should start tracking when all prerequisites are met (vrm, video, stream, enabled)', async () => {
    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        stream: mockStream,
        enabled: true,
      })
    )

    // Allow effects to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Should start initializing immediately since all prereqs are met
    await vi.waitFor(() => {
      // Either initializing or already tracking
      expect(result.current.isInitializing || result.current.isTracking).toBe(true)
    }, { timeout: 500 })

    // Should eventually be tracking
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    }, { timeout: 1000 })
  })

  it('should not initialize when disabled', () => {
    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        stream: mockStream,
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
        stream: mockStream,
        enabled: true,
      })
    )

    expect(result.current.isTracking).toBe(false)
  })

  it('should not initialize when videoRef.current is null', () => {
    const nullVideoRef = { current: null }

    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: nullVideoRef,
        stream: mockStream,
        enabled: true,
      })
    )

    expect(result.current.isTracking).toBe(false)
    expect(result.current.isInitializing).toBe(false)
  })

  it('should re-initialize tracking when stream changes', async () => {
    // Simulates the scenario where the camera stream is updated
    // (e.g., user switches camera or grants permission later)
    let currentStream: MediaStream | null = {} as MediaStream

    const { result, rerender } = renderHook(
      ({ stream }) =>
        useVRMTracking({
          vrm: mockVRM as never,
          videoRef: mockVideoRef,
          stream,
          enabled: true,
        }),
      { initialProps: { stream: currentStream } }
    )

    // Should eventually be tracking
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    }, { timeout: 500 })

    // Simulate stream changing (e.g., new camera selected)
    const newStream = {} as MediaStream
    rerender({ stream: newStream })

    // Should still be tracking after stream change
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    }, { timeout: 500 })
  })

  it('should indicate waiting for video state when video is not ready', async () => {
    // Video element exists but isn't ready (no source/data yet)
    const unreadyVideoRef = {
      current: {
        readyState: 0,
        videoWidth: 0,
        videoHeight: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLVideoElement,
    }

    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: unreadyVideoRef,
        stream: mockStream,
        enabled: true,
      })
    )

    // Allow effects to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Should indicate waiting for video
    await vi.waitFor(() => {
      expect(result.current.isWaitingForVideo).toBe(true)
    }, { timeout: 500 })

    // Should not be actively tracking yet
    expect(result.current.isTracking).toBe(false)
  })

  it('should transition from waiting to tracking when video becomes ready', async () => {
    // Start with video not ready
    let readyState = 0
    let videoWidth = 0
    const listeners: Record<string, EventListener[]> = {
      loadeddata: [],
      canplay: [],
    }

    const videoRef = {
      current: {
        get readyState() { return readyState },
        get videoWidth() { return videoWidth },
        videoHeight: 0,
        addEventListener: (event: string, listener: EventListener) => {
          if (!listeners[event]) listeners[event] = []
          listeners[event].push(listener)
        },
        removeEventListener: (event: string, listener: EventListener) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(l => l !== listener)
          }
        },
      } as unknown as HTMLVideoElement,
    }

    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef,
        stream: mockStream,
        enabled: true,
      })
    )

    // Allow effects to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Should be waiting for video
    await vi.waitFor(() => {
      expect(result.current.isWaitingForVideo).toBe(true)
    }, { timeout: 500 })

    // Simulate video becoming ready
    readyState = 4
    videoWidth = 640

    // Trigger the loadeddata event
    await act(async () => {
      listeners.loadeddata?.forEach(listener => listener(new Event('loadeddata')))
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Should now be tracking
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
      expect(result.current.isWaitingForVideo).toBe(false)
    }, { timeout: 500 })
  })
})
