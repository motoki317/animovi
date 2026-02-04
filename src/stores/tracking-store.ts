/**
 * Tracking Store - Zustand store for tracking state and debug data.
 */

import { create } from 'zustand'
import type { HolisticResult } from '../lib/solver/holistic-solver'

export type PipelineState = 'idle' | 'initializing' | 'waiting-video' | 'tracking' | 'error'

export interface DebugData {
  pipelineState: PipelineState
  detection: {
    hasFace: boolean
    hasPose: boolean
    hasLeftHand: boolean
    hasRightHand: boolean
    faceLandmarkCount: number
    poseLandmarkCount: number
  }
  /** Raw pose landmark positions for debugging IK */
  rawPose?: {
    leftShoulder?: { x: number; y: number; z: number }
    rightShoulder?: { x: number; y: number; z: number }
    leftWrist?: { x: number; y: number; z: number }
    rightWrist?: { x: number; y: number; z: number }
  }
  solved: HolisticResult | null
  performance: {
    fps: number
    frameTimeMs: number
  }
  lastUpdateTime: number
  error: string | null
}

interface TrackingState {
  isTracking: boolean
  result: HolisticResult | null
  debugData: DebugData | null
  debugEnabled: boolean
  setTracking: (isTracking: boolean) => void
  setResult: (result: HolisticResult | null) => void
  setDebugData: (data: DebugData) => void
  setDebugEnabled: (enabled: boolean) => void
}

export const useTrackingStore = create<TrackingState>((set) => ({
  isTracking: false,
  result: null,
  debugData: null,
  debugEnabled: false,
  setTracking: (isTracking) => set({ isTracking }),
  setResult: (result) => set({ result }),
  setDebugData: (debugData) => set({ debugData }),
  setDebugEnabled: (debugEnabled) => set({ debugEnabled }),
}))
