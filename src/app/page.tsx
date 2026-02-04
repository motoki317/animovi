'use client'

/**
 * HomePage - Main application page integrating all components.
 */

import { useEffect, useCallback } from 'react'
import { CameraProvider } from '../components/camera-provider'
import { AvatarScene } from '../components/avatar-scene'
import { SettingsPanel } from '../components/settings-panel'
import { BackgroundSettings, type BackgroundConfig } from '../components/background-settings'
import { useVRMLoader } from '../hooks/use-vrm-loader'
import { useSettingsStore } from '../stores/settings-store'
import { useTrackingStore } from '../stores/tracking-store'

export default function HomePage() {
  const { vrm, loading: vrmLoading, loadFromFile } = useVRMLoader()
  const settings = useSettingsStore()
  const _tracking = useTrackingStore()

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // H key to toggle panel
      if (e.key === 'h' || e.key === 'H') {
        // Don't trigger if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        settings.togglePanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settings])

  // Handle background settings change
  const handleBackgroundChange = useCallback((config: BackgroundConfig) => {
    settings.setBackgroundType(config.type)
    if (config.color) {
      settings.setBackgroundColor(config.color)
    }
    if (config.imageFile) {
      const url = URL.createObjectURL(config.imageFile)
      settings.setBackgroundImageUrl(url)
    } else if (config.imageUrl) {
      settings.setBackgroundImageUrl(config.imageUrl)
    }
  }, [settings])

  // Handle auto-frame callback
  const handleAutoFrame = useCallback((y: number, z: number) => {
    settings.setCameraY(y)
    settings.setCameraZ(z)
  }, [settings])

  return (
    <CameraProvider>
      <main style={{ display: 'flex', height: '100vh', position: 'relative' }}>
        {/* Avatar scene - full width when panel hidden */}
        <div style={{ flex: 1 }}>
          <AvatarScene
            vrm={vrm}
            backgroundType={settings.backgroundType}
            backgroundColor={settings.backgroundColor}
            cameraY={settings.cameraY}
            cameraZ={settings.cameraZ}
            autoFrameOnLoad={settings.cameraAutoFrame}
            onAutoFrame={handleAutoFrame}
          />
        </div>

        {/* Settings panel - collapsible */}
        {settings.panelVisible && (
          <aside
            style={{
              width: '300px',
              borderLeft: '1px solid #333',
              overflowY: 'auto',
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            <SettingsPanel
              smoothing={settings.smoothing}
              onSmoothingChange={settings.setSmoothing}
              faceTrackingEnabled={settings.faceTrackingEnabled}
              onFaceTrackingChange={settings.setFaceTrackingEnabled}
              poseTrackingEnabled={settings.poseTrackingEnabled}
              onPoseTrackingChange={settings.setPoseTrackingEnabled}
              handTrackingEnabled={settings.handTrackingEnabled}
              onHandTrackingChange={settings.setHandTrackingEnabled}
              onVRMImport={loadFromFile}
              vrmLoading={vrmLoading}
            />

            {/* Camera Controls */}
            <div style={{ padding: '0 1rem 1rem', borderBottom: '1px solid #444' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Camera</h4>

              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Height: {settings.cameraY.toFixed(2)}
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={settings.cameraY}
                  onChange={(e) => settings.setCameraY(parseFloat(e.target.value))}
                  style={{ display: 'block', width: '100%' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Distance: {settings.cameraZ.toFixed(2)}
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.1"
                  value={settings.cameraZ}
                  onChange={(e) => settings.setCameraZ(parseFloat(e.target.value))}
                  style={{ display: 'block', width: '100%' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={settings.cameraAutoFrame}
                  onChange={(e) => settings.setCameraAutoFrame(e.target.checked)}
                />
                {' '}Auto-frame on VRM load
              </label>
            </div>

            {/* Background Controls */}
            <div style={{ padding: '1rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Background</h4>
              <BackgroundSettings
                type={settings.backgroundType}
                color={settings.backgroundColor}
                imageUrl={settings.backgroundImageUrl}
                onChange={handleBackgroundChange}
                showPresets={true}
              />
            </div>

            {/* Hide Panel Button */}
            <div style={{ padding: '1rem', borderTop: '1px solid #444' }}>
              <button
                onClick={() => settings.setPanelVisible(false)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Hide Panel (H)
              </button>
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem', textAlign: 'center' }}>
                Move mouse to right edge to restore
              </p>
            </div>
          </aside>
        )}

        {/* Panel restore trigger zone - shown when panel is hidden */}
        {!settings.panelVisible && (
          <div
            onMouseEnter={() => settings.setPanelVisible(true)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '20px',
              height: '100%',
              cursor: 'pointer',
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1))',
            }}
            title="Show settings panel"
          />
        )}
      </main>
    </CameraProvider>
  )
}
