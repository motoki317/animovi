import { describe, it, expect, vi } from 'vitest'
import { captureThumbnail } from './vrm-thumbnail'

describe('vrm-thumbnail', () => {
  it('should return a JPEG Blob from the canvas', async () => {
    const mockCanvas = {
      toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.7)
        callback(new Blob(['jpeg-data'], { type: 'image/jpeg' }))
      }),
    } as unknown as HTMLCanvasElement

    const blob = await captureThumbnail(mockCanvas)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/jpeg')
  })

  it('should reject if canvas.toBlob returns null', async () => {
    const mockCanvas = {
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(null)
      }),
    } as unknown as HTMLCanvasElement

    await expect(captureThumbnail(mockCanvas)).rejects.toThrow('Failed to capture thumbnail')
  })
})
