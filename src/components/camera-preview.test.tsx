import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CameraPreview } from './camera-preview'

describe('CameraPreview', () => {
  let mockVideoRef: React.RefObject<HTMLVideoElement>

  beforeEach(() => {
    mockVideoRef = {
      current: document.createElement('video'),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should display live camera feed', () => {
    render(<CameraPreview videoRef={mockVideoRef} />)

    // Should render video element
    expect(screen.getByTestId('camera-preview-video')).toBeInTheDocument()
  })

  it('should be toggleable on/off', () => {
    const { rerender } = render(
      <CameraPreview videoRef={mockVideoRef} visible={true} />
    )

    expect(screen.getByTestId('camera-preview-container')).toBeVisible()

    rerender(<CameraPreview videoRef={mockVideoRef} visible={false} />)

    expect(screen.queryByTestId('camera-preview-container')).not.toBeVisible()
  })

  it('should be positioned in corner by default', () => {
    render(<CameraPreview videoRef={mockVideoRef} />)

    const container = screen.getByTestId('camera-preview-container')
    expect(container).toHaveClass('camera-preview--corner')
  })

  it('should support different positions', () => {
    const { rerender } = render(
      <CameraPreview videoRef={mockVideoRef} position="bottom-left" />
    )

    let container = screen.getByTestId('camera-preview-container')
    expect(container).toHaveClass('camera-preview--bottom-left')

    rerender(<CameraPreview videoRef={mockVideoRef} position="top-right" />)

    container = screen.getByTestId('camera-preview-container')
    expect(container).toHaveClass('camera-preview--top-right')
  })

  it('should have configurable size', () => {
    render(<CameraPreview videoRef={mockVideoRef} size="large" />)

    const container = screen.getByTestId('camera-preview-container')
    expect(container).toHaveClass('camera-preview--large')
  })

  it('should call onToggle when visibility toggle clicked', () => {
    const onToggle = vi.fn()
    render(
      <CameraPreview videoRef={mockVideoRef} onToggle={onToggle} showToggle />
    )

    const toggleButton = screen.getByRole('button', { name: /toggle/i })
    fireEvent.click(toggleButton)

    expect(onToggle).toHaveBeenCalled()
  })

  it('should show tracking overlay when enabled', () => {
    render(<CameraPreview videoRef={mockVideoRef} showLandmarks />)

    expect(screen.getByTestId('landmarks-overlay')).toBeInTheDocument()
  })

  it('should hide tracking overlay by default', () => {
    render(<CameraPreview videoRef={mockVideoRef} />)

    expect(screen.queryByTestId('landmarks-overlay')).not.toBeInTheDocument()
  })

  it('should mirror video by default', () => {
    render(<CameraPreview videoRef={mockVideoRef} />)

    const video = screen.getByTestId('camera-preview-video')
    expect(video).toHaveStyle({ transform: 'scaleX(-1)' })
  })

  it('should allow disabling mirror mode', () => {
    render(<CameraPreview videoRef={mockVideoRef} mirror={false} />)

    const video = screen.getByTestId('camera-preview-video')
    expect(video).not.toHaveStyle({ transform: 'scaleX(-1)' })
  })
})
