/**
 * MediaPipeTracker - Wrapper around MediaPipe HolisticLandmarker
 * Provides face, pose, and hand landmark detection.
 */

import {
  FilesetResolver,
  HolisticLandmarker,
  HolisticLandmarkerResult,
} from '@mediapipe/tasks-vision'

export interface MediaPipeTrackerOptions {
  /** Number of faces to detect (default: 1) */
  numFaces?: number
  /** Number of hands to detect (default: 2) */
  numHands?: number
  /** Number of poses to detect (default: 1) */
  numPoses?: number
  /** Minimum confidence for face detection (0-1, default: 0.5) */
  minFaceDetectionConfidence?: number
  /** Minimum confidence for pose detection (0-1, default: 0.5) */
  minPoseDetectionConfidence?: number
  /** Minimum confidence for hand detection (0-1, default: 0.5) */
  minHandDetectionConfidence?: number
  /** CDN base URL for WASM files (default: jsDelivr) */
  wasmBasePath?: string
}

const DEFAULT_WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

export class MediaPipeTracker {
  private landmarker: HolisticLandmarker | null = null
  private options: MediaPipeTrackerOptions

  constructor(options: MediaPipeTrackerOptions = {}) {
    this.options = {
      numFaces: options.numFaces ?? 1,
      numHands: options.numHands ?? 2,
      numPoses: options.numPoses ?? 1,
      minFaceDetectionConfidence: options.minFaceDetectionConfidence ?? 0.5,
      minPoseDetectionConfidence: options.minPoseDetectionConfidence ?? 0.5,
      minHandDetectionConfidence: options.minHandDetectionConfidence ?? 0.5,
      wasmBasePath: options.wasmBasePath ?? DEFAULT_WASM_BASE_PATH,
    }
  }

  /**
   * Initialize the MediaPipe HolisticLandmarker.
   * This loads WASM files and creates the detector.
   */
  async initialize(): Promise<void> {
    // Load WASM files
    const vision = await FilesetResolver.forVisionTasks(this.options.wasmBasePath!)

    // Create the holistic landmarker
    this.landmarker = await HolisticLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: this.options.numFaces,
      numHands: this.options.numHands,
      numPoses: this.options.numPoses,
      minFaceDetectionConfidence: this.options.minFaceDetectionConfidence,
      minPoseDetectionConfidence: this.options.minPoseDetectionConfidence,
      minHandDetectionConfidence: this.options.minHandDetectionConfidence,
    })
  }

  /**
   * Check if the tracker is ready to detect landmarks.
   */
  isReady(): boolean {
    return this.landmarker !== null
  }

  /**
   * Detect landmarks from a video frame.
   * @param videoFrame - The video element or ImageData to process
   * @param timestamp - The timestamp of the frame in milliseconds
   * @returns Detection results or null if not initialized or detection failed
   */
  detectLandmarks(
    videoFrame: HTMLVideoElement | ImageData,
    timestamp: number
  ): HolisticLandmarkerResult | null {
    if (!this.landmarker) {
      return null
    }

    try {
      return this.landmarker.detectForVideo(videoFrame, timestamp)
    } catch (error) {
      console.error('MediaPipe detection error:', error)
      return null
    }
  }

  /**
   * Clean up resources.
   */
  async dispose(): Promise<void> {
    if (this.landmarker) {
      this.landmarker.close()
      this.landmarker = null
    }
  }
}
