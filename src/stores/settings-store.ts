/**
 * Settings Store - Zustand store for application settings.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BackgroundType = 'solid' | 'transparent' | 'image'

interface SettingsState {
  // Tracking settings
  smoothing: number
  faceTrackingEnabled: boolean
  poseTrackingEnabled: boolean
  handTrackingEnabled: boolean

  // Background settings
  backgroundType: BackgroundType
  backgroundColor: string
  backgroundImageUrl?: string

  // Camera settings
  cameraY: number
  cameraZ: number
  cameraAutoFrame: boolean

  // FPS limits
  trackingFps: number
  drawingFps: number

  // Panel visibility
  panelVisible: boolean

  // VRM persistence
  lastVrmId: number | null

  // Actions - Tracking
  setSmoothing: (value: number) => void
  setFaceTrackingEnabled: (enabled: boolean) => void
  setPoseTrackingEnabled: (enabled: boolean) => void
  setHandTrackingEnabled: (enabled: boolean) => void

  // Actions - Background
  setBackgroundType: (type: BackgroundType) => void
  setBackgroundColor: (color: string) => void
  setBackgroundImageUrl: (url: string | undefined) => void

  // Actions - Camera
  setCameraY: (y: number) => void
  setCameraZ: (z: number) => void
  setCameraAutoFrame: (enabled: boolean) => void

  // Actions - FPS
  setTrackingFps: (fps: number) => void
  setDrawingFps: (fps: number) => void

  // Actions - Panel
  setPanelVisible: (visible: boolean) => void
  togglePanel: () => void

  // Actions - VRM persistence
  setLastVrmId: (id: number | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Tracking defaults
      smoothing: 0.5,
      faceTrackingEnabled: true,
      poseTrackingEnabled: true,
      handTrackingEnabled: false,

      // Background defaults
      backgroundType: 'solid',
      backgroundColor: '#1a1a2e',
      backgroundImageUrl: undefined,

      // Camera defaults (matches current hardcoded values)
      cameraY: 1.3,
      cameraZ: 1.5,
      cameraAutoFrame: true,

      // FPS limit defaults
      trackingFps: 30,
      drawingFps: 60,

      // Panel defaults
      panelVisible: true,

      // VRM persistence defaults
      lastVrmId: null,

      // Tracking actions
      setSmoothing: (smoothing) => set({ smoothing }),
      setFaceTrackingEnabled: (faceTrackingEnabled) => set({ faceTrackingEnabled }),
      setPoseTrackingEnabled: (poseTrackingEnabled) => set({ poseTrackingEnabled }),
      setHandTrackingEnabled: (handTrackingEnabled) => set({ handTrackingEnabled }),

      // Background actions
      setBackgroundType: (backgroundType) => set({ backgroundType }),
      setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
      setBackgroundImageUrl: (backgroundImageUrl) => set({ backgroundImageUrl }),

      // Camera actions
      setCameraY: (cameraY) => set({ cameraY }),
      setCameraZ: (cameraZ) => set({ cameraZ }),
      setCameraAutoFrame: (cameraAutoFrame) => set({ cameraAutoFrame }),

      // FPS actions
      setTrackingFps: (trackingFps) => set({ trackingFps }),
      setDrawingFps: (drawingFps) => set({ drawingFps }),

      // Panel actions
      setPanelVisible: (panelVisible) => set({ panelVisible }),
      togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),

      // VRM persistence actions
      setLastVrmId: (lastVrmId) => set({ lastVrmId }),
    }),
    {
      name: 'animovi-settings',
    }
  )
)
