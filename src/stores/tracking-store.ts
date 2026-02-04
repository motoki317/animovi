/**
 * Tracking Store - Zustand store for tracking state.
 */

import { create } from 'zustand'
import type { HolisticResult } from '../lib/solver/holistic-solver'

interface TrackingState {
  isTracking: boolean
  result: HolisticResult | null
  setTracking: (isTracking: boolean) => void
  setResult: (result: HolisticResult | null) => void
}

export const useTrackingStore = create<TrackingState>((set) => ({
  isTracking: false,
  result: null,
  setTracking: (isTracking) => set({ isTracking }),
  setResult: (result) => set({ result }),
}))
