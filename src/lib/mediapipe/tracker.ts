/**
 * MediaPipeTracker - Wrapper around MediaPipe landmark detection.
 *
 * Uses FaceLandmarker (lighter, ~8-12ms) when only face tracking is needed,
 * and HolisticLandmarker (~15-25ms) when pose or hand tracking is required.
 */

import {
  FilesetResolver,
  FaceLandmarker,
  HolisticLandmarker,
} from '@mediapipe/tasks-vision'

/** Unified result shape matching HolisticLandmarkerResult's landmark arrays. */
export interface TrackerResult {
  faceLandmarks: { x: number; y: number; z: number }[][]
  poseLandmarks: { x: number; y: number; z: number }[][]
  leftHandLandmarks: { x: number; y: number; z: number }[][]
  rightHandLandmarks: { x: number; y: number; z: number }[][]
}

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
  /** Whether pose tracking is needed (default: false) */
  needsPose?: boolean
  /** Whether hand tracking is needed (default: false) */
  needsHands?: boolean
}

const DEFAULT_WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

export class MediaPipeTracker {
  private holisticLandmarker: HolisticLandmarker | null = null
  private faceLandmarker: FaceLandmarker | null = null
  private options: MediaPipeTrackerOptions

  /** Which model is active: 'face' (lightweight) or 'holistic' (full). */
  get mode(): 'face' | 'holistic' {
    return this.faceLandmarker ? 'face' : 'holistic'
  }

  constructor(options: MediaPipeTrackerOptions = {}) {
    this.options = {
      numFaces: options.numFaces ?? 1,
      numHands: options.numHands ?? 2,
      numPoses: options.numPoses ?? 1,
      minFaceDetectionConfidence: options.minFaceDetectionConfidence ?? 0.5,
      minPoseDetectionConfidence: options.minPoseDetectionConfidence ?? 0.5,
      minHandDetectionConfidence: options.minHandDetectionConfidence ?? 0.5,
      wasmBasePath: options.wasmBasePath ?? DEFAULT_WASM_BASE_PATH,
      needsPose: options.needsPose ?? false,
      needsHands: options.needsHands ?? false,
    }
  }

  /**
   * Initialize the appropriate MediaPipe landmarker.
   * Uses FaceLandmarker when only face tracking is needed (faster),
   * HolisticLandmarker when pose or hand tracking is required.
   */
  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(this.options.wasmBasePath!)

    if (this.options.needsPose || this.options.needsHands) {
      this.holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minFaceDetectionConfidence: this.options.minFaceDetectionConfidence,
        minPoseDetectionConfidence: this.options.minPoseDetectionConfidence,
        minHandLandmarksConfidence: this.options.minHandDetectionConfidence,
      })
    } else {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: this.options.numFaces,
        minFaceDetectionConfidence: this.options.minFaceDetectionConfidence,
        minFacePresenceConfidence: this.options.minFaceDetectionConfidence,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      })
    }
  }

  /**
   * Check if the tracker is ready to detect landmarks.
   */
  isReady(): boolean {
    return this.holisticLandmarker !== null || this.faceLandmarker !== null
  }

  /**
   * Detect landmarks from a video frame.
   * Returns a unified TrackerResult regardless of which model is active.
   */
  detectLandmarks(
    videoFrame: HTMLVideoElement | ImageData,
    timestamp: number
  ): TrackerResult | null {
    if (this.holisticLandmarker) {
      try {
        return this.holisticLandmarker.detectForVideo(videoFrame, timestamp)
      } catch (error) {
        console.error('MediaPipe detection error:', error)
        return null
      }
    }

    if (this.faceLandmarker) {
      try {
        const result = this.faceLandmarker.detectForVideo(videoFrame, timestamp)
        return {
          faceLandmarks: result.faceLandmarks,
          poseLandmarks: [],
          leftHandLandmarks: [],
          rightHandLandmarks: [],
        }
      } catch (error) {
        console.error('MediaPipe detection error:', error)
        return null
      }
    }

    return null
  }

  /**
   * Clean up resources.
   */
  async dispose(): Promise<void> {
    if (this.holisticLandmarker) {
      this.holisticLandmarker.close()
      this.holisticLandmarker = null
    }
    if (this.faceLandmarker) {
      this.faceLandmarker.close()
      this.faceLandmarker = null
    }
  }
}
