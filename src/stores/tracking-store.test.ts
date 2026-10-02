import { describe, it, expect, beforeEach } from 'vitest'
import { useTrackingStore, type DebugData } from './tracking-store'

describe('useTrackingStore', () => {
  beforeEach(() => {
    useTrackingStore.setState({
      debugData: null,
      debugEnabled: false,
      stickFigureEnabled: false,
    })
  })

  it('should initialize with default values', () => {
    const state = useTrackingStore.getState()

    expect(state.debugData).toBeNull()
    expect(state.debugEnabled).toBe(false)
    expect(state.stickFigureEnabled).toBe(false)
  })

  it('should update stickFigureEnabled state', () => {
    useTrackingStore.getState().setStickFigureEnabled(true)
    expect(useTrackingStore.getState().stickFigureEnabled).toBe(true)
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
          eyes: { leftBlink: 0.5, rightBlink: 0.5, gazeX: 0, gazeY: 0 },
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
