/**
 * Main-thread tracker that use-vrm-tracking.ts uses when the tracking worker
 * fails to start. It loads FaceLandmarker when pose and hands are off, because
 * HolisticLandmarker runs its pose and hand models even when only face
 * landmarks are read (29d1a90).
 */

import {
  FilesetResolver,
  FaceLandmarker,
  HolisticLandmarker,
} from '@mediapipe/tasks-vision'
import { WASM_BASE_PATH, HOLISTIC_MODEL_PATH, FACE_MODEL_PATH } from './constants'

/** Subset of HolisticLandmarkerResult. Face mode fills only faceLandmarks. */
export interface TrackerResult {
  faceLandmarks: { x: number; y: number; z: number }[][]
  poseLandmarks: { x: number; y: number; z: number }[][]
  poseWorldLandmarks?: { x: number; y: number; z: number }[][]
  leftHandLandmarks: { x: number; y: number; z: number }[][]
  rightHandLandmarks: { x: number; y: number; z: number }[][]
}

export interface MediaPipeTrackerOptions {
  /** Face mode only. Default 1. */
  numFaces?: number
  /** 0 to 1, default 0.5. Face mode also uses it as minFacePresenceConfidence. */
  minFaceDetectionConfidence?: number
  /** 0 to 1, default 0.5. */
  minPoseDetectionConfidence?: number
  /** 0 to 1, default 0.5. Passed to HolisticLandmarker as minHandLandmarksConfidence. */
  minHandDetectionConfidence?: number
  /** Default WASM_BASE_PATH. */
  wasmBasePath?: string
  /** Selects HolisticLandmarker. Default false. */
  needsPose?: boolean
  /** Selects HolisticLandmarker. Default false. */
  needsHands?: boolean
}

const DEFAULT_WASM_BASE_PATH = WASM_BASE_PATH

export class MediaPipeTracker {
  private holisticLandmarker: HolisticLandmarker | null = null
  private faceLandmarker: FaceLandmarker | null = null
  private options: MediaPipeTrackerOptions

  /** Also 'holistic' before initialize(). */
  get mode(): 'face' | 'holistic' {
    return this.faceLandmarker ? 'face' : 'holistic'
  }

  constructor(options: MediaPipeTrackerOptions = {}) {
    this.options = {
      numFaces: options.numFaces ?? 1,
      minFaceDetectionConfidence: options.minFaceDetectionConfidence ?? 0.5,
      minPoseDetectionConfidence: options.minPoseDetectionConfidence ?? 0.5,
      minHandDetectionConfidence: options.minHandDetectionConfidence ?? 0.5,
      wasmBasePath: options.wasmBasePath ?? DEFAULT_WASM_BASE_PATH,
      needsPose: options.needsPose ?? false,
      needsHands: options.needsHands ?? false,
    }
  }

  /** Rejects when the WASM runtime or the model fails to load. */
  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(this.options.wasmBasePath!)

    if (this.options.needsPose || this.options.needsHands) {
      this.holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HOLISTIC_MODEL_PATH,
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
          modelAssetPath: FACE_MODEL_PATH,
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

  isReady(): boolean {
    return this.holisticLandmarker !== null || this.faceLandmarker !== null
  }

  /** Returns null before initialize(), or when detection throws. It logs the error. */
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
          poseWorldLandmarks: [],
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
