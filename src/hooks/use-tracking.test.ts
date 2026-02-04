import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTracking } from './use-tracking'

// Mock the worker
const mockWorkerPostMessage = vi.fn()
const mockWorkerTerminate = vi.fn()
let mockWorkerOnMessage: ((event: MessageEvent) => void) | null = null
let mockWorkerOnError: ((event: ErrorEvent) => void) | null = null
let workerInstanceCount = 0

class MockWorker {
  postMessage = mockWorkerPostMessage
  terminate = mockWorkerTerminate

  constructor() {
    workerInstanceCount++
  }

  set onmessage(handler: (event: MessageEvent) => void) {
    mockWorkerOnMessage = handler
  }

  set onerror(handler: (event: ErrorEvent) => void) {
    mockWorkerOnError = handler
  }
}

vi.stubGlobal('Worker', MockWorker)

// Mock requestAnimationFrame
let rafCallCount = 0
const mockRaf = vi.fn((callback: FrameRequestCallback) => {
  rafCallCount++
  return rafCallCount
})
const mockCancelRaf = vi.fn()

vi.stubGlobal('requestAnimationFrame', mockRaf)
vi.stubGlobal('cancelAnimationFrame', mockCancelRaf)

describe('useTracking', () => {
  let mockVideoRef: { current: HTMLVideoElement | null }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkerOnMessage = null
    mockWorkerOnError = null
    workerInstanceCount = 0
    rafCallCount = 0

    mockVideoRef = {
      current: {
        videoWidth: 640,
        videoHeight: 480,
        readyState: 4,
      } as HTMLVideoElement,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create tracking worker on mount', () => {
    const { unmount } = renderHook(() => useTracking({ videoRef: mockVideoRef }))

    expect(workerInstanceCount).toBe(1)

    unmount()
  })

  it('should send setup message to worker', () => {
    renderHook(() => useTracking({ videoRef: mockVideoRef }))

    expect(mockWorkerPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup',
      })
    )
  })

  it('should start tracking loop when enabled', () => {
    renderHook(() => useTracking({ videoRef: mockVideoRef, enabled: true }))

    expect(mockRaf).toHaveBeenCalled()
  })

  it('should not start tracking when disabled', () => {
    renderHook(() => useTracking({ videoRef: mockVideoRef, enabled: false }))

    // Should not call RAF when disabled
    // The setup message is still sent, but no frame processing
    expect(mockRaf).not.toHaveBeenCalled()
  })

  it('should handle worker messages with tracking results', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: mockVideoRef, enabled: true })
    )

    // Simulate worker sending tracking results
    act(() => {
      mockWorkerOnMessage?.({
        data: {
          type: 'result',
          payload: {
            face: { headRotation: { pitch: 0, yaw: 0, roll: 0 } },
            pose: null,
            hands: null,
          },
        },
      } as MessageEvent)
    })

    expect(result.current.trackingData).not.toBeNull()
    expect(result.current.trackingData?.face).toBeDefined()
  })

  it('should handle worker errors', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: mockVideoRef })
    )

    // Simulate worker error
    act(() => {
      mockWorkerOnError?.({
        message: 'Worker crashed',
      } as ErrorEvent)
    })

    expect(result.current.error).not.toBeNull()
  })

  it('should cleanup worker on unmount', () => {
    const { unmount } = renderHook(() =>
      useTracking({ videoRef: mockVideoRef })
    )

    unmount()

    expect(mockWorkerTerminate).toHaveBeenCalled()
  })

  it('should provide isTracking status', () => {
    const { result } = renderHook(() =>
      useTracking({ videoRef: mockVideoRef, enabled: true })
    )

    // Initially not tracking until worker confirms
    expect(result.current.isTracking).toBe(false)

    // Simulate worker ready message
    act(() => {
      mockWorkerOnMessage?.({
        data: {
          type: 'ready',
        },
      } as MessageEvent)
    })

    expect(result.current.isTracking).toBe(true)
  })

  it('should respect enabled toggle', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTracking({ videoRef: mockVideoRef, enabled }),
      { initialProps: { enabled: true } }
    )

    // Initially enabled
    expect(result.current.isTracking).toBe(false) // Until worker ready

    // Disable tracking
    rerender({ enabled: false })

    // Tracking should stop
    expect(mockCancelRaf).toHaveBeenCalled()
  })

  it('should handle missing video ref gracefully', () => {
    const emptyVideoRef = { current: null }

    const { result } = renderHook(() =>
      useTracking({ videoRef: emptyVideoRef, enabled: true })
    )

    // Should not crash, just not track
    expect(result.current.trackingData).toBeNull()
  })

  it('should send config updates to worker', () => {
    const { rerender } = renderHook(
      ({ smoothing }: { smoothing: number }) =>
        useTracking({ videoRef: mockVideoRef, smoothing }),
      { initialProps: { smoothing: 0.5 } }
    )

    // Clear initial calls
    mockWorkerPostMessage.mockClear()

    // Update smoothing
    rerender({ smoothing: 0.8 })

    expect(mockWorkerPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'config',
        payload: expect.objectContaining({
          smoothing: 0.8,
        }),
      })
    )
  })
})
