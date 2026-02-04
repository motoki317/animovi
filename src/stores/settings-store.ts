/**
 * Settings Store - Zustand store for application settings.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  smoothing: number
  faceTrackingEnabled: boolean
  poseTrackingEnabled: boolean
  handTrackingEnabled: boolean
  setSmoothing: (value: number) => void
  setFaceTrackingEnabled: (enabled: boolean) => void
  setPoseTrackingEnabled: (enabled: boolean) => void
  setHandTrackingEnabled: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      smoothing: 0.5,
      faceTrackingEnabled: true,
      poseTrackingEnabled: true,
      handTrackingEnabled: false,
      setSmoothing: (smoothing) => set({ smoothing }),
      setFaceTrackingEnabled: (faceTrackingEnabled) => set({ faceTrackingEnabled }),
      setPoseTrackingEnabled: (poseTrackingEnabled) => set({ poseTrackingEnabled }),
      setHandTrackingEnabled: (handTrackingEnabled) => set({ handTrackingEnabled }),
    }),
    {
      name: 'vrm-tuber-settings',
    }
  )
)
