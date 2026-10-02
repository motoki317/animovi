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
  /** Shoulder and wrist landmarks in image space. Main-thread mode only. */
  rawPose?: {
    leftShoulder?: { x: number; y: number; z: number }
    rightShoulder?: { x: number; y: number; z: number }
    leftWrist?: { x: number; y: number; z: number }
    rightWrist?: { x: number; y: number; z: number }
  }
  /** Set only when stickFigureEnabled is true. */
  rawLandmarks?: RawLandmarks
  /**
   * Rotations that the bridge wrote in its last update. They differ from
   * `solved` by smoothing and the boneSign correction. Set only when
   * stickFigureEnabled is true.
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
  debugData: DebugData | null
  debugEnabled: boolean
  /**
   * Separate from debugEnabled because only the stick-figure overlay needs
   * the raw landmarks and the applied rotations.
   */
  stickFigureEnabled: boolean
  setDebugData: (data: DebugData) => void
  setDebugEnabled: (enabled: boolean) => void
  setStickFigureEnabled: (enabled: boolean) => void
}

export const useTrackingStore = create<TrackingState>((set) => ({
  debugData: null,
  debugEnabled: false,
  stickFigureEnabled: false,
  setDebugData: (debugData) => set({ debugData }),
  setDebugEnabled: (debugEnabled) => set({ debugEnabled }),
  setStickFigureEnabled: (stickFigureEnabled) => set({ stickFigureEnabled }),
}))
