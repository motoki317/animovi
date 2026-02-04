import { describe, it, expect } from 'vitest'
import {
  createSetupMessage,
  createFrameMessage,
  createConfigMessage,
  parseWorkerResponse,
  type WorkerMessage,
  type WorkerResponse,
} from './protocol'

describe('WorkerProtocol', () => {
  describe('createSetupMessage', () => {
    it('should create setup message with type and config', () => {
      const message = createSetupMessage({ smoothing: 0.5 })

      expect(message.type).toBe('setup')
      expect(message.config).toEqual({ smoothing: 0.5 })
    })
  })

  describe('createFrameMessage', () => {
    it('should create frame message with imageData', () => {
      // Mock ImageData for test environment
      const mockImageData = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(10 * 10 * 4),
      } as unknown as ImageData

      const message = createFrameMessage(mockImageData)

      expect(message.type).toBe('frame')
      expect((message as { type: 'frame'; imageData: ImageData }).imageData).toBe(mockImageData)
    })
  })

  describe('createConfigMessage', () => {
    it('should create config message with partial config', () => {
      const message = createConfigMessage({ smoothing: 0.8 })

      expect(message.type).toBe('config')
      expect((message as { type: 'config'; config: object }).config).toEqual({ smoothing: 0.8 })
    })
  })

  describe('parseWorkerResponse', () => {
    it('should parse ready response', () => {
      const response = parseWorkerResponse({ type: 'ready' })

      expect(response.type).toBe('ready')
    })

    it('should parse result response with data', () => {
      const data = { face: { pitch: 0.1 } }
      const response = parseWorkerResponse({ type: 'result', data })

      expect(response.type).toBe('result')
      expect((response as { type: 'result'; data: unknown }).data).toEqual(data)
    })

    it('should parse error response with message', () => {
      const response = parseWorkerResponse({ type: 'error', message: 'Test error' })

      expect(response.type).toBe('error')
      expect((response as { type: 'error'; message: string }).message).toBe('Test error')
    })

    it('should throw for invalid response type', () => {
      expect(() => parseWorkerResponse({ type: 'invalid' })).toThrow()
    })
  })
})
