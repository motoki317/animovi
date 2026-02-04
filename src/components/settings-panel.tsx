'use client'

/**
 * SettingsPanel - Controls for tracking and display settings.
 */

export interface SettingsPanelProps {
  smoothing: number
  onSmoothingChange: (value: number) => void
  faceTrackingEnabled: boolean
  onFaceTrackingChange: (enabled: boolean) => void
  poseTrackingEnabled: boolean
  onPoseTrackingChange: (enabled: boolean) => void
  handTrackingEnabled: boolean
  onHandTrackingChange: (enabled: boolean) => void
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
}: SettingsPanelProps) {
  return (
    <div className="settings-panel" style={{ padding: '1rem' }}>
      <h3>Settings</h3>

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
    </div>
  )
}
