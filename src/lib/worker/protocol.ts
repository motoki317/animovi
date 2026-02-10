/**
 * Worker Message Protocol - Types for main thread <-> tracking worker communication.
 */

import type { HolisticResult } from '../solver/holistic-solver'

// --- Messages from Main Thread to Worker ---

export type WorkerInMessage =
  | { type: 'init'; needsPose: boolean; needsHands: boolean }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }

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
  | { type: 'result'; data: HolisticResult; detection: WorkerDetectionInfo }
  | { type: 'error'; message: string }
