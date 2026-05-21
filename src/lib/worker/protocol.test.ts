import { describe, it, expect } from 'vitest'
import type { WorkerInMessage, WorkerOutMessage, WorkerDetectionInfo } from './protocol'

describe('WorkerProtocol', () => {
  describe('WorkerInMessage types', () => {
    it('should type init message correctly', () => {
      const msg: WorkerInMessage = { type: 'init', needsPose: true, needsHands: false }
      expect(msg.type).toBe('init')
    })

    it('should type frame message correctly', () => {
      const mockBitmap = {} as ImageBitmap
      const msg: WorkerInMessage = { type: 'frame', bitmap: mockBitmap, timestamp: 1000 }
      expect(msg.type).toBe('frame')
    })

    it('should type set-debug message correctly', () => {
      const on: WorkerInMessage = { type: 'set-debug', enabled: true }
      const off: WorkerInMessage = { type: 'set-debug', enabled: false }
      expect(on.type).toBe('set-debug')
      expect(off.type).toBe('set-debug')
    })
  })

  describe('WorkerOutMessage types', () => {
    it('should type ready message correctly', () => {
      const msg: WorkerOutMessage = { type: 'ready', mode: 'face' }
      expect(msg.type).toBe('ready')
      expect(msg.mode).toBe('face')
    })

    it('should type result message correctly', () => {
      const detection: WorkerDetectionInfo = {
        hasFace: true,
        hasPose: false,
        hasLeftHand: false,
        hasRightHand: false,
        faceLandmarkCount: 478,
        poseLandmarkCount: 0,
      }
      const msg: WorkerOutMessage = {
        type: 'result',
        data: { face: null, pose: null, leftHand: null, rightHand: null },
        detection,
      }
      expect(msg.type).toBe('result')
    })

    it('should allow optional rawLandmarks on result', () => {
      const detection: WorkerDetectionInfo = {
        hasFace: false,
        hasPose: true,
        hasLeftHand: false,
        hasRightHand: false,
        faceLandmarkCount: 0,
        poseLandmarkCount: 33,
      }
      const msg: WorkerOutMessage = {
        type: 'result',
        data: { face: null, pose: null, leftHand: null, rightHand: null },
        detection,
        rawLandmarks: {
          pose: [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }],
        },
      }
      if (msg.type === 'result') {
        expect(msg.rawLandmarks?.pose?.length).toBe(1)
      }
    })

    it('should type error message correctly', () => {
      const msg: WorkerOutMessage = { type: 'error', message: 'Test error' }
      expect(msg.type).toBe('error')
      expect(msg.message).toBe('Test error')
    })
  })
})
