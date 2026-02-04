import { describe, it, expect, beforeEach } from 'vitest'
import { useTrackingStore } from './tracking-store'

describe('useTrackingStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useTrackingStore.setState({
      isTracking: false,
      result: null,
    })
  })

  it('should initialize with default values', () => {
    const state = useTrackingStore.getState()

    expect(state.isTracking).toBe(false)
    expect(state.result).toBeNull()
  })

  it('should update isTracking state', () => {
    useTrackingStore.getState().setTracking(true)

    expect(useTrackingStore.getState().isTracking).toBe(true)
  })

  it('should update result', () => {
    const mockResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    useTrackingStore.getState().setResult(mockResult)

    expect(useTrackingStore.getState().result).toEqual(mockResult)
  })
})
