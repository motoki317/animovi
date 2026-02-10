import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create hoisted mocks
const mocks = vi.hoisted(() => ({
  holisticDetectForVideo: vi.fn(),
  holisticClose: vi.fn(),
  holisticCreateFromOptions: vi.fn(),
  faceDetectForVideo: vi.fn(),
  faceClose: vi.fn(),
  faceCreateFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
  solveHolistic: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => {
  mocks.holisticCreateFromOptions.mockResolvedValue({
    detectForVideo: mocks.holisticDetectForVideo,
    close: mocks.holisticClose,
  })
  mocks.faceCreateFromOptions.mockResolvedValue({
    detectForVideo: mocks.faceDetectForVideo,
    close: mocks.faceClose,
  })
  mocks.forVisionTasks.mockResolvedValue({
    wasmLoaderPath: '/mock/wasm-loader.js',
    wasmBinaryPath: '/mock/wasm.wasm',
  })

  return {
    FilesetResolver: { forVisionTasks: mocks.forVisionTasks },
    HolisticLandmarker: { createFromOptions: mocks.holisticCreateFromOptions },
    FaceLandmarker: { createFromOptions: mocks.faceCreateFromOptions },
  }
})

vi.mock('../solver/holistic-solver', () => ({
  solveHolistic: mocks.solveHolistic,
}))

describe('TrackingWorker', () => {
  let postedMessages: unknown[]
  const mockSolvedResult = {
    face: { head: { pitch: 0, yaw: 0, roll: 0 }, eyes: { leftBlink: 0, rightBlink: 0, gazeX: 0, gazeY: 0 }, mouth: { open: 0, smile: 0 } },
    pose: null,
    leftHand: null,
    rightHand: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    postedMessages = []

    // Re-setup mocks
    mocks.holisticCreateFromOptions.mockResolvedValue({
      detectForVideo: mocks.holisticDetectForVideo,
      close: mocks.holisticClose,
    })
    mocks.faceCreateFromOptions.mockResolvedValue({
      detectForVideo: mocks.faceDetectForVideo,
      close: mocks.faceClose,
    })
    mocks.forVisionTasks.mockResolvedValue({
      wasmLoaderPath: '/mock/wasm-loader.js',
      wasmBinaryPath: '/mock/wasm.wasm',
    })
    mocks.solveHolistic.mockReturnValue(mockSolvedResult)

    vi.stubGlobal('postMessage', (data: unknown) => {
      postedMessages.push(data)
    })
  })

  describe('handleInit', () => {
    it('should initialize FaceLandmarker when no pose/hands needed', async () => {
      const { handleInit } = await import('./tracking.worker')

      await handleInit(false, false)

      expect(mocks.faceCreateFromOptions).toHaveBeenCalled()
      expect(mocks.holisticCreateFromOptions).not.toHaveBeenCalled()
      expect(postedMessages).toContainEqual({ type: 'ready', mode: 'face' })
    })

    it('should initialize HolisticLandmarker when pose is needed', async () => {
      const { handleInit } = await import('./tracking.worker')

      await handleInit(true, false)

      expect(mocks.holisticCreateFromOptions).toHaveBeenCalled()
      expect(postedMessages).toContainEqual({ type: 'ready', mode: 'holistic' })
    })

    it('should post error on initialization failure', async () => {
      mocks.forVisionTasks.mockRejectedValueOnce(new Error('WASM load failed'))
      const { handleInit } = await import('./tracking.worker')

      await handleInit(false, false)

      expect(postedMessages).toContainEqual(
        expect.objectContaining({ type: 'error', message: 'WASM load failed' })
      )
    })
  })

  describe('handleFrame', () => {
    it('should detect face landmarks and return solved result', async () => {
      const { handleInit, handleFrame } = await import('./tracking.worker')
      mocks.faceDetectForVideo.mockReturnValue({
        faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      })

      await handleInit(false, false)
      postedMessages = []

      const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
      handleFrame(mockBitmap, 1000)

      expect(mocks.faceDetectForVideo).toHaveBeenCalledWith(mockBitmap, 1000)
      expect(mockBitmap.close).toHaveBeenCalled()
      expect(mocks.solveHolistic).toHaveBeenCalled()
      expect(postedMessages).toContainEqual(
        expect.objectContaining({
          type: 'result',
          data: mockSolvedResult,
          detection: expect.objectContaining({ hasFace: true }),
        })
      )
    })

    it('should detect holistic landmarks when in holistic mode', async () => {
      const { handleInit, handleFrame } = await import('./tracking.worker')
      mocks.holisticDetectForVideo.mockReturnValue({
        faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        poseLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        leftHandLandmarks: [],
        rightHandLandmarks: [],
      })

      await handleInit(true, false)
      postedMessages = []

      const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
      handleFrame(mockBitmap, 1000)

      expect(mocks.holisticDetectForVideo).toHaveBeenCalledWith(mockBitmap, 1000)
      expect(mockBitmap.close).toHaveBeenCalled()
      expect(postedMessages).toContainEqual(
        expect.objectContaining({
          type: 'result',
          detection: expect.objectContaining({ hasFace: true, hasPose: true }),
        })
      )
    })

    it('should close bitmap and post error on detection failure', async () => {
      const { handleInit, handleFrame } = await import('./tracking.worker')
      mocks.faceDetectForVideo.mockImplementation(() => {
        throw new Error('Detection failed')
      })

      await handleInit(false, false)
      postedMessages = []

      const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
      handleFrame(mockBitmap, 1000)

      expect(mockBitmap.close).toHaveBeenCalled()
      expect(postedMessages).toContainEqual(
        expect.objectContaining({ type: 'error', message: 'Detection failed' })
      )
    })
  })
})
