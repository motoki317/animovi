/**
 * Tracking Store - Zustand store for tracking state and debug data.
 */

import { create } from 'zustand'
import type { HolisticResult } from '../lib/solver/holistic-solver'
import type { RawLandmarks } from '../lib/worker/protocol'
import type { AppliedRotations } from '../lib/vrm/tracking-bridge'

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
  /**
   * Full raw landmark snapshot used by the stick-figure overlay. Populated only
   * when stickFigureEnabled — keeping it in DebugData (not the regular tracking
   * result) so the data lifetime is bound to the debug surface that needs it.
   */
  rawLandmarks?: RawLandmarks
  /**
   * Bone rotations actually written to the VRM in the last bridge update.
   * Captured separately from `solved` because the bridge applies smoothing,
   * sign correction, and clamps that shift the values away from `solved`.
   */
  appliedRotations?: AppliedRotations
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
  /**
   * Separate from debugEnabled because the stick-figure overlay needs heavier
   * data (raw landmarks crossing the worker boundary) that we don't want to
   * ship just for the text debug HUD.
   */
  stickFigureEnabled: boolean
  setTracking: (isTracking: boolean) => void
  setResult: (result: HolisticResult | null) => void
  setDebugData: (data: DebugData) => void
  setDebugEnabled: (enabled: boolean) => void
  setStickFigureEnabled: (enabled: boolean) => void
}

export const useTrackingStore = create<TrackingState>((set) => ({
  isTracking: false,
  result: null,
  debugData: null,
  debugEnabled: false,
  stickFigureEnabled: false,
  setTracking: (isTracking) => set({ isTracking }),
  setResult: (result) => set({ result }),
  setDebugData: (debugData) => set({ debugData }),
  setDebugEnabled: (debugEnabled) => set({ debugEnabled }),
  setStickFigureEnabled: (stickFigureEnabled) => set({ stickFigureEnabled }),
}))
