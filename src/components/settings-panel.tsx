'use client'

/**
 * SettingsPanel - Controls for tracking and display settings.
 */

import { useRef } from 'react'

export interface SettingsPanelProps {
  smoothing: number
  onSmoothingChange: (value: number) => void
  faceTrackingEnabled: boolean
  onFaceTrackingChange: (enabled: boolean) => void
  poseTrackingEnabled: boolean
  onPoseTrackingChange: (enabled: boolean) => void
  handTrackingEnabled: boolean
  onHandTrackingChange: (enabled: boolean) => void
  trackingFps: number
  onTrackingFpsChange: (fps: number) => void
  drawingFps: number
  onDrawingFpsChange: (fps: number) => void
  /** Optional: callback when a VRM file is selected for import */
  onVRMImport?: (file: File) => void
  /** Optional: whether VRM is currently loading */
  vrmLoading?: boolean
}

export function SettingsPanel({
  smoothing,
  onSmoothingChange,
  faceTrackingEnabled,
  onFaceTrackingChange,
  poseTrackingEnabled,
  onPoseTrackingChange,
  handTrackingEnabled,
  onHandTrackingChange,
  trackingFps,
  onTrackingFpsChange,
  drawingFps,
  onDrawingFpsChange,
  onVRMImport,
  vrmLoading = false,
}: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onVRMImport) {
      onVRMImport(file)
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="settings-panel" style={{ padding: '1rem' }}>
      <h3>Settings</h3>

      {/* VRM Import Section */}
      {onVRMImport && (
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #444' }}>
          <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Avatar</h4>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vrm,.glb"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            data-testid="vrm-file-input"
          />
          <button
            onClick={handleImportClick}
            disabled={vrmLoading}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              cursor: vrmLoading ? 'not-allowed' : 'pointer',
              opacity: vrmLoading ? 0.6 : 1,
            }}
            data-testid="import-vrm-button"
          >
            {vrmLoading ? 'Loading...' : 'Import VRM'}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
            Supports .vrm and .glb files
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="smoothing">
          Smoothing: {smoothing.toFixed(2)}
          <input
            id="smoothing"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={smoothing}
            onChange={(e) => onSmoothingChange(parseFloat(e.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label>
          <input
            type="checkbox"
            checked={faceTrackingEnabled}
            onChange={(e) => onFaceTrackingChange(e.target.checked)}
          />
          {' '}Face Tracking
        </label>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label>
          <input
            type="checkbox"
            checked={poseTrackingEnabled}
            onChange={(e) => onPoseTrackingChange(e.target.checked)}
          />
          {' '}Pose Tracking
        </label>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label>
          <input
            type="checkbox"
            checked={handTrackingEnabled}
            onChange={(e) => onHandTrackingChange(e.target.checked)}
          />
          {' '}Hand Tracking
        </label>
      </div>

      <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
        <label htmlFor="trackingFps">
          Tracking FPS: {trackingFps}
          <input
            id="trackingFps"
            type="range"
            min="10"
            max="60"
            step="5"
            value={trackingFps}
            onChange={(e) => onTrackingFpsChange(parseInt(e.target.value, 10))}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="drawingFps">
          Drawing FPS: {drawingFps}
          <input
            id="drawingFps"
            type="range"
            min="15"
            max="120"
            step="5"
            value={drawingFps}
            onChange={(e) => onDrawingFpsChange(parseInt(e.target.value, 10))}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
      </div>
    </div>
  )
}
