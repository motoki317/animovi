import { describe, it, expect, beforeEach } from 'vitest'
import { useTrackingStore, type DebugData } from './tracking-store'

describe('useTrackingStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useTrackingStore.setState({
      isTracking: false,
      result: null,
      debugData: null,
      debugEnabled: false,
    })
  })

  it('should initialize with default values', () => {
    const state = useTrackingStore.getState()

    expect(state.isTracking).toBe(false)
    expect(state.result).toBeNull()
    expect(state.debugData).toBeNull()
    expect(state.debugEnabled).toBe(false)
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

  it('should update debugEnabled state', () => {
    useTrackingStore.getState().setDebugEnabled(true)

    expect(useTrackingStore.getState().debugEnabled).toBe(true)
  })

  it('should update debugData', () => {
    const mockDebugData: DebugData = {
      pipelineState: 'tracking',
      detection: {
        hasFace: true,
        hasPose: true,
        hasLeftHand: false,
        hasRightHand: false,
        faceLandmarkCount: 478,
        poseLandmarkCount: 33,
      },
      solved: {
        face: {
          head: { pitch: 0.1, yaw: 0.2, roll: 0 },
          eyes: { leftBlink: 0.5, rightBlink: 0.5 },
          mouth: { open: 0.3, smile: 0.2 },
        },
        pose: null,
        leftHand: null,
        rightHand: null,
      },
      performance: {
        fps: 30,
        frameTimeMs: 33.3,
      },
      lastUpdateTime: 12345,
      error: null,
    }

    useTrackingStore.getState().setDebugData(mockDebugData)

    expect(useTrackingStore.getState().debugData).toEqual(mockDebugData)
  })
})
