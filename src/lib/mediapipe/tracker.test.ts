import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaPipeTracker, MediaPipeTrackerOptions } from './tracker'

// Create hoisted mocks that can be accessed inside vi.mock
const mocks = vi.hoisted(() => ({
  holisticDetectForVideo: vi.fn(),
  holisticSetOptions: vi.fn(),
  holisticClose: vi.fn(),
  holisticCreateFromOptions: vi.fn(),
  faceDetectForVideo: vi.fn(),
  faceClose: vi.fn(),
  faceCreateFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => {
  const createMockHolisticLandmarker = () => ({
    detectForVideo: mocks.holisticDetectForVideo,
    setOptions: mocks.holisticSetOptions,
    close: mocks.holisticClose,
  })

  const createMockFaceLandmarker = () => ({
    detectForVideo: mocks.faceDetectForVideo,
    close: mocks.faceClose,
  })

  mocks.holisticCreateFromOptions.mockResolvedValue(createMockHolisticLandmarker())
  mocks.faceCreateFromOptions.mockResolvedValue(createMockFaceLandmarker())
  mocks.forVisionTasks.mockResolvedValue({
    wasmLoaderPath: '/mock/wasm-loader.js',
    wasmBinaryPath: '/mock/wasm.wasm',
  })

  return {
    FilesetResolver: {
      forVisionTasks: mocks.forVisionTasks,
    },
    HolisticLandmarker: {
      createFromOptions: mocks.holisticCreateFromOptions,
    },
    FaceLandmarker: {
      createFromOptions: mocks.faceCreateFromOptions,
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
    mocks.holisticCreateFromOptions.mockResolvedValue({
      detectForVideo: mocks.holisticDetectForVideo,
      setOptions: mocks.holisticSetOptions,
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
    tracker = new MediaPipeTracker()
  })

  afterEach(async () => {
    await tracker.dispose()
  })

  describe('Model selection', () => {
    it('should use FaceLandmarker by default (no pose/hand needed)', async () => {
      await tracker.initialize()

      expect(mocks.forVisionTasks).toHaveBeenCalled()
      expect(mocks.faceCreateFromOptions).toHaveBeenCalled()
      expect(mocks.holisticCreateFromOptions).not.toHaveBeenCalled()
      expect(tracker.mode).toBe('face')
    })

    it('should use HolisticLandmarker when pose tracking is needed', async () => {
      tracker = new MediaPipeTracker({ needsPose: true })
      await tracker.initialize()

      expect(mocks.holisticCreateFromOptions).toHaveBeenCalled()
      expect(mocks.faceCreateFromOptions).not.toHaveBeenCalled()
      expect(tracker.mode).toBe('holistic')
    })

    it('should use HolisticLandmarker when hand tracking is needed', async () => {
      tracker = new MediaPipeTracker({ needsHands: true })
      await tracker.initialize()

      expect(mocks.holisticCreateFromOptions).toHaveBeenCalled()
      expect(mocks.faceCreateFromOptions).not.toHaveBeenCalled()
      expect(tracker.mode).toBe('holistic')
    })
  })

  describe('FaceLandmarker mode', () => {
    it('should detect face landmarks and return unified result', async () => {
      const mockFaceResult = {
        faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      }
      mocks.faceDetectForVideo.mockReturnValue(mockFaceResult)

      await tracker.initialize()

      const mockVideoFrame = { width: 640, height: 480 } as HTMLVideoElement
      const results = tracker.detectLandmarks(mockVideoFrame, 1000)

      expect(mocks.faceDetectForVideo).toHaveBeenCalledWith(mockVideoFrame, 1000)
      expect(results).toEqual({
        faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        poseLandmarks: [],
        poseWorldLandmarks: [],
        leftHandLandmarks: [],
        rightHandLandmarks: [],
      })
    })

    it('should handle detection errors gracefully', async () => {
      mocks.faceDetectForVideo.mockImplementation(() => {
        throw new Error('Detection failed')
      })

      await tracker.initialize()

      const mockVideoFrame = {} as HTMLVideoElement
      const results = tracker.detectLandmarks(mockVideoFrame, 1000)

      expect(results).toBeNull()
    })

    it('should clean up on dispose', async () => {
      await tracker.initialize()
      await tracker.dispose()

      expect(mocks.faceClose).toHaveBeenCalled()
    })
  })

  describe('HolisticLandmarker mode', () => {
    it('should detect all landmarks', async () => {
      const mockResults = {
        faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        poseLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        leftHandLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
        rightHandLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      }
      mocks.holisticDetectForVideo.mockReturnValue(mockResults)

      tracker = new MediaPipeTracker({ needsPose: true })
      await tracker.initialize()

      const mockVideoFrame = { width: 640, height: 480 } as HTMLVideoElement
      const results = tracker.detectLandmarks(mockVideoFrame, 1000)

      expect(mocks.holisticDetectForVideo).toHaveBeenCalledWith(mockVideoFrame, 1000)
      expect(results).toBe(mockResults)
    })

    it('should handle detection errors gracefully', async () => {
      mocks.holisticDetectForVideo.mockImplementation(() => {
        throw new Error('Detection failed')
      })

      tracker = new MediaPipeTracker({ needsPose: true })
      await tracker.initialize()

      const mockVideoFrame = {} as HTMLVideoElement
      const results = tracker.detectLandmarks(mockVideoFrame, 1000)

      expect(results).toBeNull()
    })

    it('should clean up on dispose', async () => {
      tracker = new MediaPipeTracker({ needsPose: true })
      await tracker.initialize()
      await tracker.dispose()

      expect(mocks.holisticClose).toHaveBeenCalled()
    })

    it('should support custom options', async () => {
      const options: MediaPipeTrackerOptions = {
        numFaces: 2,
        numHands: 4,
        numPoses: 2,
        minFaceDetectionConfidence: 0.7,
        minPoseDetectionConfidence: 0.7,
        minHandDetectionConfidence: 0.7,
        needsPose: true,
      }

      tracker = new MediaPipeTracker(options)
      await tracker.initialize()

      expect(mocks.holisticCreateFromOptions).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          minFaceDetectionConfidence: 0.7,
          minPoseDetectionConfidence: 0.7,
          minHandLandmarksConfidence: 0.7,
        })
      )
    })
  })

  it('should return null if not initialized', () => {
    const mockVideoFrame = {} as HTMLVideoElement
    const results = tracker.detectLandmarks(mockVideoFrame, 1000)

    expect(results).toBeNull()
    expect(mocks.holisticDetectForVideo).not.toHaveBeenCalled()
    expect(mocks.faceDetectForVideo).not.toHaveBeenCalled()
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
