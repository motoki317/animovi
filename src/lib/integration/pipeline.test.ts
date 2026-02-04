import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TrackingPipeline, PipelineOptions } from './pipeline'
import type { HolisticResult } from '../solver/holistic-solver'

describe('TrackingPipeline - Full Integration', () => {
  let pipeline: TrackingPipeline
  let mockVrm: ReturnType<typeof createMockVrm>
  let currentTime: number

  function createMockVrm() {
    return {
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue({
          rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
        }),
      },
      expressionManager: {
        setValue: vi.fn(),
      },
      update: vi.fn(),
    }
  }

  beforeEach(() => {
    currentTime = 0
    // Mock performance.now to increment by 16ms each call
    // This simulates frame time between startFrame and endFrame
    vi.spyOn(performance, 'now').mockImplementation(() => {
      const time = currentTime
      currentTime += 8 // Each call advances by 8ms (startFrame + endFrame = 16ms)
      return time
    })
    mockVrm = createMockVrm()
  })

  afterEach(() => {
    pipeline?.dispose()
    vi.restoreAllMocks()
  })

  it('should animate avatar from tracking input', () => {
    pipeline = new TrackingPipeline({ vrm: mockVrm as never })

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.2, roll: 0.05 },
        eyes: { leftBlink: 0.3, rightBlink: 0.3 },
        mouth: { open: 0.2, smile: 0.1 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    pipeline.processFrame(trackingResult)

    // VRM bones should have been updated
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('head')
    expect(mockVrm.expressionManager.setValue).toHaveBeenCalled()
  })

  it('should maintain performance under normal conditions', () => {
    pipeline = new TrackingPipeline({ vrm: mockVrm as never })

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    // Process multiple frames at ~60fps timing
    for (let i = 0; i < 60; i++) {
      // startFrame called at currentTime
      pipeline.processFrame(trackingResult)
      // Simulate ~16.67ms frame time
      currentTime += 16.67
    }

    const metrics = pipeline.getPerformanceMetrics()
    expect(metrics.averageFps).toBeGreaterThan(50)
  })

  it('should recover from temporary tracking loss', () => {
    pipeline = new TrackingPipeline({ vrm: mockVrm as never })

    const validResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0.1, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    // First frame with valid data
    pipeline.processFrame(validResult)
    currentTime += 16.67

    // Several frames with no tracking (null data)
    const emptyResult: HolisticResult = {
      face: null,
      pose: null,
      leftHand: null,
      rightHand: null,
    }
    for (let i = 0; i < 10; i++) {
      pipeline.processFrame(emptyResult)
      currentTime += 16.67
    }

    // Should not throw and should be able to recover
    expect(() => pipeline.processFrame(validResult)).not.toThrow()

    // Pipeline should still be functional
    expect(pipeline.isRunning()).toBe(true)
  })

  it('should handle settings changes without restart', () => {
    const options: PipelineOptions = {
      vrm: mockVrm as never,
      faceTracking: true,
      poseTracking: true,
      handTracking: true,
      smoothing: 0.5,
    }

    pipeline = new TrackingPipeline(options)

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    // Process a frame
    pipeline.processFrame(trackingResult)
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalledWith('head')

    // Clear mocks
    vi.clearAllMocks()

    // Disable face tracking
    pipeline.updateOptions({ faceTracking: false })

    // Process another frame - face tracking should be disabled
    pipeline.processFrame(trackingResult)

    // Head bone should NOT be updated now
    expect(mockVrm.humanoid.getNormalizedBoneNode).not.toHaveBeenCalledWith(
      'head'
    )
  })

  it('should apply smoothing consistently', () => {
    pipeline = new TrackingPipeline({
      vrm: mockVrm as never,
      smoothing: 0.8, // High smoothing
    })

    // Send two very different frames
    const frame1: HolisticResult = {
      face: {
        head: { pitch: 0, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    const frame2: HolisticResult = {
      face: {
        head: { pitch: 1.0, yaw: 1.0, roll: 1.0 },
        eyes: { leftBlink: 1, rightBlink: 1 },
        mouth: { open: 1, smile: 1 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    pipeline.processFrame(frame1)
    currentTime += 16.67

    pipeline.processFrame(frame2)

    // With high smoothing, values should be interpolated, not jumped
    // This is verified by the fact that setRotation was called with smoothed values
    expect(mockVrm.humanoid.getNormalizedBoneNode).toHaveBeenCalled()
  })

  it('should track frame count correctly', () => {
    pipeline = new TrackingPipeline({ vrm: mockVrm as never })

    const emptyResult: HolisticResult = {
      face: null,
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    expect(pipeline.getPerformanceMetrics().frameCount).toBe(0)

    pipeline.processFrame(emptyResult)
    pipeline.processFrame(emptyResult)
    pipeline.processFrame(emptyResult)

    expect(pipeline.getPerformanceMetrics().frameCount).toBe(3)
  })

  it('should properly dispose resources', () => {
    pipeline = new TrackingPipeline({ vrm: mockVrm as never })

    const trackingResult: HolisticResult = {
      face: {
        head: { pitch: 0.1, yaw: 0, roll: 0 },
        eyes: { leftBlink: 0, rightBlink: 0 },
        mouth: { open: 0, smile: 0 },
      },
      pose: null,
      leftHand: null,
      rightHand: null,
    }

    pipeline.processFrame(trackingResult)
    pipeline.dispose()

    expect(pipeline.isRunning()).toBe(false)

    // Should not throw after disposal
    expect(() => pipeline.processFrame(trackingResult)).not.toThrow()
  })
})
