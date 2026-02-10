'use client'

/**
 * SettingsPanel - Controls for tracking and display settings.
 */

import { useRef } from 'react'
import type { VRMMeta } from '../lib/vrm/vrm-storage'

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
  /** Stored VRM metadata list for the gallery */
  storedVRMs?: VRMMeta[]
  /** Currently active VRM ID */
  activeVrmId?: number | null
  /** Callback to load a stored VRM */
  onVRMSelect?: (id: number) => void
  /** Callback to delete a stored VRM */
  onVRMDelete?: (id: number) => void
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
  storedVRMs = [],
  activeVrmId = null,
  onVRMSelect,
  onVRMDelete,
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

      {/* VRM Import + Gallery Section */}
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

          {/* VRM Gallery */}
          {storedVRMs.length > 0 && (
            <div
              data-testid="vrm-gallery"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                marginTop: '0.75rem',
              }}
            >
              {storedVRMs.map((vrm) => (
                <div
                  key={vrm.id}
                  data-testid={`vrm-gallery-item-${vrm.id}`}
                  style={{
                    position: 'relative',
                    border: activeVrmId === vrm.id ? '2px solid #4fc3f7' : '2px solid #444',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    opacity: vrmLoading ? 0.6 : 1,
                  }}
                  onClick={() => !vrmLoading && onVRMSelect?.(vrm.id)}
                >
                  {vrm.thumbnail instanceof Blob && vrm.thumbnail.size > 0 ? (
                    <img
                      src={URL.createObjectURL(vrm.thumbnail)}
                      alt={vrm.name}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        background: '#333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                      }}
                    >
                      ?
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.6rem',
                      padding: '2px 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}
                    title={vrm.name}
                  >
                    {vrm.name}
                  </div>
                  <button
                    data-testid={`vrm-delete-${vrm.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onVRMDelete?.(vrm.id)
                    }}
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      width: '18px',
                      height: '18px',
                      border: 'none',
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Delete"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
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
