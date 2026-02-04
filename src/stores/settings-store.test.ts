import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingsStore } from './settings-store'

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  }),
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    useSettingsStore.setState({
      smoothing: 0.5,
      faceTrackingEnabled: true,
      poseTrackingEnabled: true,
      handTrackingEnabled: false,
    })
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
})
