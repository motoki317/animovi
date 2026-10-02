import { describe, it, expect, vi, beforeEach, afterEach, onTestFinished } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVRMTracking } from './use-vrm-tracking'
import { useTrackingStore } from '../stores/tracking-store'
import { solveHolistic } from '../lib/solver/holistic-solver'

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

vi.mock('../lib/vrm/tracking-bridge', () => {
  class MockTrackingBridge {
    update = vi.fn()
    setSmoothing = vi.fn()
    dispose = vi.fn()
  }
  return { TrackingBridge: MockTrackingBridge }
})

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

  const mockStream = {} as MediaStream

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await vi.waitFor(() => {
      expect(result.current.isInitializing || result.current.isTracking).toBe(true)
    }, { timeout: 500 })

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

    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    }, { timeout: 500 })

    const newStream = {} as MediaStream
    rerender({ stream: newStream })

    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    }, { timeout: 500 })
  })

  it('should indicate waiting for video state when video is not ready', async () => {
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await vi.waitFor(() => {
      expect(result.current.isWaitingForVideo).toBe(true)
    }, { timeout: 500 })

    expect(result.current.isTracking).toBe(false)
  })

  it('should transition from waiting to tracking when video becomes ready', async () => {
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await vi.waitFor(() => {
      expect(result.current.isWaitingForVideo).toBe(true)
    }, { timeout: 500 })

    readyState = 4
    videoWidth = 640

    await act(async () => {
      listeners.loadeddata?.forEach(listener => listener(new Event('loadeddata')))
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
      expect(result.current.isWaitingForVideo).toBe(false)
    }, { timeout: 500 })
  })

  it('applies a new target FPS to the running loop', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const { result, rerender } = renderHook(
      ({ targetFps }) =>
        useVRMTracking({
          vrm: mockVRM as never,
          videoRef: mockVideoRef,
          stream: mockStream,
          enabled: true,
          targetFps,
        }),
      { initialProps: { targetFps: 30 } }
    )
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    })

    rerender({ targetFps: 10 })
    vi.mocked(solveHolistic).mockClear()
    for (let t = 0; t <= 1000; t += 1000 / 60) {
      frames.splice(0).forEach((cb) => cb(t))
    }

    // 10 FPS over one second. The 30 FPS interval gives about 30.
    expect(vi.mocked(solveHolistic).mock.calls.length).toBeLessThanOrEqual(11)
  })

  it('terminates a worker that becomes ready after unmount', async () => {
    const workers: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null
      onerror: (() => void) | null = null
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor() {
        workers.push(this)
      }
    }
    vi.stubGlobal('Worker', FakeWorker)

    const { unmount } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        stream: mockStream,
        enabled: true,
      })
    )
    await vi.waitFor(() => {
      expect(workers).toHaveLength(1)
    })

    unmount()
    await act(async () => {
      workers[0].onmessage!({ data: { type: 'ready', mode: 'gpu' } })
    })

    expect(workers[0].terminate).toHaveBeenCalled()
  })

  it('falls back to main-thread tracking when the worker fails after init', async () => {
    const workers: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null
      onerror: (() => void) | null = null
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor() {
        workers.push(this)
      }
    }
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ close: vi.fn() }))
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    let now = 0
    const runFrames = async (count: number) => {
      for (let i = 0; i < count; i++) {
        now += 100
        frames.splice(0).forEach((cb) => cb(now))
        await act(async () => {})
      }
    }

    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        stream: mockStream,
        enabled: true,
      })
    )
    await vi.waitFor(() => {
      expect(workers).toHaveLength(1)
    })
    await act(async () => {
      workers[0].onmessage!({ data: { type: 'ready', mode: 'gpu' } })
    })
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    })
    await runFrames(1)
    expect(workers[0].postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'frame' }),
      expect.anything()
    )

    await act(async () => {
      workers[0].onerror!()
    })
    vi.mocked(solveHolistic).mockClear()
    await runFrames(3)

    expect(solveHolistic).toHaveBeenCalled()
  })

  it('reports the worker result rate as the tracking fps', async () => {
    const workers: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null
      onerror: (() => void) | null = null
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor() {
        workers.push(this)
      }
    }
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ close: vi.fn() }))
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    useTrackingStore.getState().setDebugEnabled(true)
    onTestFinished(() => {
      useTrackingStore.getState().setDebugEnabled(false)
    })

    const { result } = renderHook(() =>
      useVRMTracking({
        vrm: mockVRM as never,
        videoRef: mockVideoRef,
        stream: mockStream,
        enabled: true,
      })
    )
    await vi.waitFor(() => {
      expect(workers).toHaveLength(1)
    })
    await act(async () => {
      workers[0].onmessage!({ data: { type: 'ready', mode: 'gpu' } })
    })
    await vi.waitFor(() => {
      expect(result.current.isTracking).toBe(true)
    })

    let now = 1000
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    onTestFinished(() => {
      clock.mockRestore()
    })
    const message = { data: { type: 'result', data: null, detection: null } }
    act(() => workers[0].onmessage!(message))
    now += 50
    act(() => workers[0].onmessage!(message))

    expect(useTrackingStore.getState().debugData?.performance.fps).toBeCloseTo(20)
  })
})
