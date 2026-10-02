import type { HolisticResult } from '../solver/holistic-solver'

export interface RawLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/**
 * MediaPipe image-space landmarks: x and y in [0, 1], z as relative depth.
 * A field is absent when MediaPipe detects nothing for that part. Face-only
 * mode never has pose or hand fields.
 */
export interface RawLandmarks {
  pose?: RawLandmark[]
  leftHand?: RawLandmark[]
  rightHand?: RawLandmark[]
  face?: RawLandmark[]
}

/**
 * The main thread sends one `init`, then one `frame` at a time. It transfers
 * each `bitmap`, and the worker closes it. The worker answers `init` with
 * `ready` or `error`, and each `frame` with exactly one `result` or `error`.
 * The main thread waits for that answer before it sends the next frame.
 */
export type WorkerInMessage =
  | { type: 'init'; needsPose: boolean; needsHands: boolean }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }

export interface WorkerDetectionInfo {
  hasFace: boolean
  hasPose: boolean
  hasLeftHand: boolean
  hasRightHand: boolean
  faceLandmarkCount: number
  poseLandmarkCount: number
}

export type WorkerOutMessage =
  | { type: 'ready'; mode: 'face' | 'holistic' }
  | {
      type: 'result'
      data: HolisticResult
      detection: WorkerDetectionInfo
      rawLandmarks?: RawLandmarks
    }
  | { type: 'error'; message: string }
