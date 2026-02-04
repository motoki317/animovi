import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the worker message handling
interface MockWorkerContext {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: (data: unknown) => void
}

describe('TrackingWorker', () => {
  let mockContext: MockWorkerContext
  let postedMessages: unknown[]

  beforeEach(() => {
    postedMessages = []
    mockContext = {
      onmessage: null,
      postMessage: (data: unknown) => {
        postedMessages.push(data)
      },
    }
  })

  describe('handleMessage', () => {
    it('should respond with ready after setup message', async () => {
      const { handleMessage } = await import('./tracking.worker')

      await handleMessage({ type: 'setup', config: { smoothing: 0.5 } }, mockContext.postMessage)

      expect(postedMessages).toContainEqual({ type: 'ready' })
    })

    it('should handle config update message', async () => {
      const { handleMessage } = await import('./tracking.worker')

      // First setup
      await handleMessage({ type: 'setup', config: { smoothing: 0.5 } }, mockContext.postMessage)
      postedMessages = []

      // Then config update
      await handleMessage({ type: 'config', config: { smoothing: 0.8 } }, mockContext.postMessage)

      // Config updates don't send a response, just update internal state
      expect(postedMessages).toHaveLength(0)
    })

    it('should post error for unknown message type', async () => {
      const { handleMessage } = await import('./tracking.worker')

      await handleMessage({ type: 'unknown' } as never, mockContext.postMessage)

      expect(postedMessages).toContainEqual(
        expect.objectContaining({ type: 'error' })
      )
    })

    it('should process frame and return result when tracker is initialized', async () => {
      const { handleMessage, setTracker } = await import('./tracking.worker')
      const mockImageData = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(10 * 10 * 4),
      } as unknown as ImageData

      // Mock tracker that returns empty landmarks
      const mockTracker = {
        detect: vi.fn().mockResolvedValue({
          faceLandmarks: [],
          poseLandmarks: [],
          leftHandLandmarks: [],
          rightHandLandmarks: [],
        }),
      }
      setTracker(mockTracker)

      await handleMessage({ type: 'setup', config: {} }, mockContext.postMessage)
      postedMessages = []

      await handleMessage({ type: 'frame', imageData: mockImageData }, mockContext.postMessage)

      expect(postedMessages).toContainEqual(
        expect.objectContaining({ type: 'result' })
      )
    })
  })
})
