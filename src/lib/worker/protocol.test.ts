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

    it('should type error message correctly', () => {
      const msg: WorkerOutMessage = { type: 'error', message: 'Test error' }
      expect(msg.type).toBe('error')
      expect(msg.message).toBe('Test error')
    })
  })
})
