import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './settings-store'

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true)
  })

  it('should initialize with default values', () => {
    const state = useSettingsStore.getState()

    expect(state.smoothing).toBe(0.5)
    expect(state.faceTrackingEnabled).toBe(true)
    expect(state.poseTrackingEnabled).toBe(true)
    expect(state.handTrackingEnabled).toBe(false)
  })

  it('should update smoothing', () => {
    useSettingsStore.getState().setSmoothing(0.8)

    expect(useSettingsStore.getState().smoothing).toBe(0.8)
  })

  it('should toggle face tracking', () => {
    useSettingsStore.getState().setFaceTrackingEnabled(false)

    expect(useSettingsStore.getState().faceTrackingEnabled).toBe(false)
  })

  it('should update background settings', () => {
    useSettingsStore.getState().setBackgroundType('transparent')
    useSettingsStore.getState().setBackgroundColor('#00ff00')

    const state = useSettingsStore.getState()
    expect(state.backgroundType).toBe('transparent')
    expect(state.backgroundColor).toBe('#00ff00')
  })

  it('should update camera settings', () => {
    useSettingsStore.getState().setCameraY(1.5)
    useSettingsStore.getState().setCameraZ(2.0)
    useSettingsStore.getState().setCameraAutoFrame(false)

    const state = useSettingsStore.getState()
    expect(state.cameraY).toBe(1.5)
    expect(state.cameraZ).toBe(2.0)
    expect(state.cameraAutoFrame).toBe(false)
  })

  it('should toggle panel visibility', () => {
    useSettingsStore.getState().setPanelVisible(false)
    expect(useSettingsStore.getState().panelVisible).toBe(false)

    useSettingsStore.getState().togglePanel()
    expect(useSettingsStore.getState().panelVisible).toBe(true)
  })

  it('should initialize tracking FPS with default 30', () => {
    const state = useSettingsStore.getState()
    expect(state.trackingFps).toBe(30)
  })

  it('should update tracking FPS', () => {
    useSettingsStore.getState().setTrackingFps(15)
    expect(useSettingsStore.getState().trackingFps).toBe(15)
  })

  it('should initialize drawing FPS with default 60', () => {
    const state = useSettingsStore.getState()
    expect(state.drawingFps).toBe(60)
  })

  it('should update drawing FPS', () => {
    useSettingsStore.getState().setDrawingFps(30)
    expect(useSettingsStore.getState().drawingFps).toBe(30)
  })

  it('should initialize lastVrmId as null', () => {
    expect(useSettingsStore.getState().lastVrmId).toBeNull()
  })

  it('should update lastVrmId', () => {
    useSettingsStore.getState().setLastVrmId(42)
    expect(useSettingsStore.getState().lastVrmId).toBe(42)
  })

  it('should clear lastVrmId to null', () => {
    useSettingsStore.getState().setLastVrmId(42)
    useSettingsStore.getState().setLastVrmId(null)
    expect(useSettingsStore.getState().lastVrmId).toBeNull()
  })

  it('does not persist the background image URL', () => {
    useSettingsStore.getState().setBackgroundType('image')
    useSettingsStore.getState().setBackgroundImageUrl('blob:http://localhost/bg')

    const stored = JSON.parse(localStorage.getItem('animovi-settings')!)
    expect(stored.state.backgroundType).toBe('image')
    expect(stored.state).not.toHaveProperty('backgroundImageUrl')
  })

  it('ignores a background image URL stored by an earlier version', async () => {
    localStorage.setItem('animovi-settings', JSON.stringify({
      state: { backgroundType: 'image', backgroundImageUrl: 'blob:http://localhost/dead' },
      version: 0,
    }))

    await useSettingsStore.persist.rehydrate()

    expect(useSettingsStore.getState().backgroundType).toBe('image')
    expect(useSettingsStore.getState().backgroundImageUrl).toBeUndefined()
  })
})
