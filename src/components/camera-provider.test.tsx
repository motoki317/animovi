import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CameraProvider, useCamera } from './camera-provider'

// Mock getUserMedia
const mockGetUserMedia = vi.fn()
const mockEnumerateDevices = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: mockEnumerateDevices,
    },
    writable: true,
  })
})

function TestComponent() {
  const { stream, error, isLoading } = useCamera()
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</span>
      <span data-testid="error">{error?.message ?? 'no-error'}</span>
      <span data-testid="stream">{stream ? 'has-stream' : 'no-stream'}</span>
    </div>
  )
}

describe('CameraProvider', () => {
  it('should provide loading state initially', () => {
    mockGetUserMedia.mockReturnValue(new Promise(() => {})) // Never resolves

    render(
      <CameraProvider>
        <TestComponent />
      </CameraProvider>
    )

    expect(screen.getByTestId('loading').textContent).toBe('loading')
    expect(screen.getByTestId('stream').textContent).toBe('no-stream')
  })

  it('should provide stream when camera access granted', async () => {
    const mockStream = {
      getTracks: () => [],
    } as unknown as MediaStream
    mockGetUserMedia.mockResolvedValue(mockStream)
    mockEnumerateDevices.mockResolvedValue([])

    render(
      <CameraProvider>
        <TestComponent />
      </CameraProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('stream').textContent).toBe('has-stream')
      expect(screen.getByTestId('loading').textContent).toBe('not-loading')
    })
  })

  it('should provide error when camera access denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

    render(
      <CameraProvider>
        <TestComponent />
      </CameraProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Permission denied')
      expect(screen.getByTestId('loading').textContent).toBe('not-loading')
    })
  })
})
