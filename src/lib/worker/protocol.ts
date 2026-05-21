/**
 * Worker Message Protocol - Types for main thread <-> tracking worker communication.
 */

import type { HolisticResult } from '../solver/holistic-solver'

/** Minimal landmark shape shared by pose/hand/face raw landmarks. */
export interface RawLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/**
 * Raw MediaPipe landmarks attached to a result message when the worker is in debug mode.
 * Image-space (x/y normalized 0-1, z relative). Each field is optional because
 * face-only mode emits no pose/hand data.
 */
export interface RawLandmarks {
  pose?: RawLandmark[]
  leftHand?: RawLandmark[]
  rightHand?: RawLandmark[]
  face?: RawLandmark[]
}

// --- Messages from Main Thread to Worker ---

export type WorkerInMessage =
  | { type: 'init'; needsPose: boolean; needsHands: boolean }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'set-debug'; enabled: boolean }

// --- Messages from Worker to Main Thread ---

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
