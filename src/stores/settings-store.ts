import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BackgroundType = 'solid' | 'transparent' | 'image'

interface SettingsState {
  smoothing: number
  faceTrackingEnabled: boolean
  poseTrackingEnabled: boolean
  handTrackingEnabled: boolean

  backgroundType: BackgroundType
  backgroundColor: string
  backgroundImageUrl?: string

  cameraY: number
  cameraZ: number
  cameraAutoFrame: boolean

  trackingFps: number
  drawingFps: number

  panelVisible: boolean

  /** IndexedDB ID of the VRM that page.tsx loads on startup. */
  lastVrmId: number | null

  setSmoothing: (value: number) => void
  setFaceTrackingEnabled: (enabled: boolean) => void
  setPoseTrackingEnabled: (enabled: boolean) => void
  setHandTrackingEnabled: (enabled: boolean) => void

  setBackgroundType: (type: BackgroundType) => void
  setBackgroundColor: (color: string) => void
  setBackgroundImageUrl: (url: string | undefined) => void

  setCameraY: (y: number) => void
  setCameraZ: (z: number) => void
  setCameraAutoFrame: (enabled: boolean) => void

  setTrackingFps: (fps: number) => void
  setDrawingFps: (fps: number) => void

  setPanelVisible: (visible: boolean) => void
  togglePanel: () => void

  setLastVrmId: (id: number | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      smoothing: 0.5,
      faceTrackingEnabled: true,
      poseTrackingEnabled: true,
      handTrackingEnabled: false,

      backgroundType: 'solid',
      backgroundColor: '#1a1a2e',
      backgroundImageUrl: undefined,

      cameraY: 1.3,
      cameraZ: 1.5,
      cameraAutoFrame: true,

      trackingFps: 30,
      drawingFps: 60,

      panelVisible: true,

      lastVrmId: null,

      setSmoothing: (smoothing) => set({ smoothing }),
      setFaceTrackingEnabled: (faceTrackingEnabled) => set({ faceTrackingEnabled }),
      setPoseTrackingEnabled: (poseTrackingEnabled) => set({ poseTrackingEnabled }),
      setHandTrackingEnabled: (handTrackingEnabled) => set({ handTrackingEnabled }),

      setBackgroundType: (backgroundType) => set({ backgroundType }),
      setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
      setBackgroundImageUrl: (backgroundImageUrl) => set({ backgroundImageUrl }),

      setCameraY: (cameraY) => set({ cameraY }),
      setCameraZ: (cameraZ) => set({ cameraZ }),
      setCameraAutoFrame: (cameraAutoFrame) => set({ cameraAutoFrame }),

      setTrackingFps: (trackingFps) => set({ trackingFps }),
      setDrawingFps: (drawingFps) => set({ drawingFps }),

      setPanelVisible: (panelVisible) => set({ panelVisible }),
      togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),

      setLastVrmId: (lastVrmId) => set({ lastVrmId }),
    }),
    // The default localStorage storage is synchronous, so the store hydrates
    // when this module loads, before the first client render.
    {
      name: 'animovi-settings',
      // A blob: URL dies with the page, so a stored one never loads after a reload.
      partialize: ({ backgroundImageUrl: _, ...persisted }) => persisted,
      // Earlier versions stored the URL. Ignore it.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SettingsState>),
        backgroundImageUrl: current.backgroundImageUrl,
      }),
    }
  )
)
