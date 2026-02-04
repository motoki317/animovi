import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaPipeTracker, MediaPipeTrackerOptions } from './tracker'

// Create hoisted mocks that can be accessed inside vi.mock
const mocks = vi.hoisted(() => ({
  detectForVideo: vi.fn(),
  setOptions: vi.fn(),
  close: vi.fn(),
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => {
  const createMockLandmarker = () => ({
    detectForVideo: mocks.detectForVideo,
    setOptions: mocks.setOptions,
    close: mocks.close,
  })

  mocks.createFromOptions.mockResolvedValue(createMockLandmarker())
  mocks.forVisionTasks.mockResolvedValue({
    wasmLoaderPath: '/mock/wasm-loader.js',
    wasmBinaryPath: '/mock/wasm.wasm',
  })

  return {
    FilesetResolver: {
      forVisionTasks: mocks.forVisionTasks,
    },
    HolisticLandmarker: {
      createFromOptions: mocks.createFromOptions,
    },
    FaceLandmarker: {
      FACE_LANDMARKS_TESSELATION: [],
    },
    PoseLandmarker: {
      POSE_CONNECTIONS: [],
    },
    HandLandmarker: {
      HAND_CONNECTIONS: [],
    },
  }
})

describe('MediaPipeTracker', () => {
  let tracker: MediaPipeTracker

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-setup the mock resolved values after clearing
    mocks.createFromOptions.mockResolvedValue({
      detectForVideo: mocks.detectForVideo,
      setOptions: mocks.setOptions,
      close: mocks.close,
    })
    mocks.forVisionTasks.mockResolvedValue({
      wasmLoaderPath: '/mock/wasm-loader.js',
      wasmBinaryPath: '/mock/wasm.wasm',
    })
    tracker = new MediaPipeTracker()
  })

  afterEach(async () => {
    await tracker.dispose()
  })

  it('should initialize HolisticLandmarker', async () => {
    await tracker.initialize()

    expect(mocks.forVisionTasks).toHaveBeenCalled()
    expect(mocks.createFromOptions).toHaveBeenCalled()
  })

  it('should detect landmarks from video frame', async () => {
    const mockResults = {
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      poseLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      leftHandLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      rightHandLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
    }
    mocks.detectForVideo.mockReturnValue(mockResults)

    await tracker.initialize()

    const mockVideoFrame = {
      width: 640,
      height: 480,
    } as HTMLVideoElement

    const results = tracker.detectLandmarks(mockVideoFrame, 1000)

    expect(mocks.detectForVideo).toHaveBeenCalledWith(mockVideoFrame, 1000)
    expect(results).toBe(mockResults)
  })

  it('should handle detection errors gracefully', async () => {
    mocks.detectForVideo.mockImplementation(() => {
      throw new Error('Detection failed')
    })

    await tracker.initialize()

    const mockVideoFrame = {} as HTMLVideoElement
    const results = tracker.detectLandmarks(mockVideoFrame, 1000)

    expect(results).toBeNull()
  })

  it('should return null if not initialized', () => {
    const mockVideoFrame = {} as HTMLVideoElement
    const results = tracker.detectLandmarks(mockVideoFrame, 1000)

    expect(results).toBeNull()
    expect(mocks.detectForVideo).not.toHaveBeenCalled()
  })

  it('should clean up resources on dispose', async () => {
    await tracker.initialize()
    await tracker.dispose()

    expect(mocks.close).toHaveBeenCalled()
  })

  it('should support custom options', async () => {
    const options: MediaPipeTrackerOptions = {
      numFaces: 2,
      numHands: 4,
      numPoses: 2,
      minFaceDetectionConfidence: 0.7,
      minPoseDetectionConfidence: 0.7,
      minHandDetectionConfidence: 0.7,
    }

    tracker = new MediaPipeTracker(options)
    await tracker.initialize()

    expect(mocks.createFromOptions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        numFaces: 2,
        numHands: 4,
        numPoses: 2,
      })
    )
  })

  it('should report initialization status', async () => {
    expect(tracker.isReady()).toBe(false)

    await tracker.initialize()

    expect(tracker.isReady()).toBe(true)

    await tracker.dispose()

    expect(tracker.isReady()).toBe(false)
  })

  it('should handle WASM loading errors', async () => {
    mocks.forVisionTasks.mockRejectedValueOnce(new Error('WASM load failed'))

    const newTracker = new MediaPipeTracker()

    await expect(newTracker.initialize()).rejects.toThrow('WASM load failed')
  })
})
