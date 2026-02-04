'use client'

/**
 * CameraPreview - Picture-in-picture style camera preview overlay.
 * Displays live camera feed with optional landmark visualization.
 */

import { useEffect, useRef } from 'react'
import './camera-preview.css'

export type PreviewPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export type PreviewSize = 'small' | 'medium' | 'large'

export interface CameraPreviewProps {
  /** Reference to the video element providing camera feed */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Whether the preview is visible (default: true) */
  visible?: boolean
  /** Position of the preview (default: bottom-right) */
  position?: PreviewPosition
  /** Size of the preview (default: medium) */
  size?: PreviewSize
  /** Whether to show toggle button */
  showToggle?: boolean
  /** Callback when toggle is clicked */
  onToggle?: () => void
  /** Whether to show tracking landmarks overlay */
  showLandmarks?: boolean
  /** Landmark data for overlay visualization */
  landmarks?: unknown
  /** Whether to mirror the video (default: true) */
  mirror?: boolean
}

export function CameraPreview({
  videoRef,
  visible = true,
  position = 'bottom-right',
  size = 'medium',
  showToggle = false,
  onToggle,
  showLandmarks = false,
  landmarks,
  mirror = true,
}: CameraPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw landmarks on canvas when they change
  useEffect(() => {
    if (!showLandmarks || !landmarks || !canvasRef.current) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw landmarks (simplified - actual implementation would render points)
    // This is a placeholder for landmark visualization
  }, [landmarks, showLandmarks])

  const positionClass =
    position === 'bottom-right'
      ? 'camera-preview--corner'
      : `camera-preview--${position}`

  const sizeClass = `camera-preview--${size}`

  return (
    <div
      data-testid="camera-preview-container"
      className={`camera-preview ${positionClass} ${sizeClass}`}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
    >
      <video
        data-testid="camera-preview-video"
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        autoPlay
        playsInline
        muted
        style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      />

      {showLandmarks && (
        <canvas
          data-testid="landmarks-overlay"
          ref={canvasRef}
          className="camera-preview__landmarks"
        />
      )}

      {showToggle && (
        <button
          className="camera-preview__toggle"
          onClick={onToggle}
          aria-label="Toggle camera preview"
        >
          {visible ? '−' : '+'}
        </button>
      )}
    </div>
  )
}
