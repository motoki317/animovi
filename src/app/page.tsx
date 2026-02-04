'use client'

/**
 * HomePage - Main application page integrating all components.
 */

import { useEffect, useCallback, useRef } from 'react'
import { CameraProvider, useCamera } from '../components/camera-provider'
import { AvatarScene } from '../components/avatar-scene'
import { SettingsPanel } from '../components/settings-panel'
import { BackgroundSettings, type BackgroundConfig } from '../components/background-settings'
import { useVRMLoader } from '../hooks/use-vrm-loader'
import { useVRMTracking } from '../hooks/use-vrm-tracking'
import { useSettingsStore } from '../stores/settings-store'

function HomePageContent() {
  const { vrm, loading: vrmLoading, loadFromFile } = useVRMLoader()
  const settings = useSettingsStore()
  const { stream } = useCamera()

  // Video element for tracking
  const videoRef = useRef<HTMLVideoElement>(null)

  // Connect camera stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, that's ok
      })
    }
  }, [stream])

  // Use VRM tracking
  const { isTracking, isInitializing, error: trackingError } = useVRMTracking({
    vrm,
    videoRef,
    enabled: settings.faceTrackingEnabled || settings.poseTrackingEnabled || settings.handTrackingEnabled,
    smoothing: settings.smoothing,
    faceTracking: settings.faceTrackingEnabled,
    poseTracking: settings.poseTrackingEnabled,
    handTracking: settings.handTrackingEnabled,
  })

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

  // Get stable setter references from the store
  const {
    setBackgroundType,
    setBackgroundColor,
    setBackgroundImageUrl,
    setCameraY,
    setCameraZ,
  } = settings

  // Handle background settings change - stable callback
  const handleBackgroundChange = useCallback((config: BackgroundConfig) => {
    setBackgroundType(config.type)
    if (config.color) {
      setBackgroundColor(config.color)
    }
    if (config.imageFile) {
      const url = URL.createObjectURL(config.imageFile)
      setBackgroundImageUrl(url)
    } else if (config.imageUrl) {
      setBackgroundImageUrl(config.imageUrl)
    }
  }, [setBackgroundType, setBackgroundColor, setBackgroundImageUrl])

  // Handle auto-frame callback - stable because Zustand setters are stable
  const handleAutoFrame = useCallback((y: number, z: number) => {
    setCameraY(y)
    setCameraZ(z)
  }, [setCameraY, setCameraZ])

  return (
    <main style={{ display: 'flex', height: '100vh', position: 'relative' }}>
      {/* Hidden video element for tracking */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

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

      {/* Tracking status indicator */}
      {(isInitializing || trackingError) && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            padding: '0.5rem 1rem',
            background: trackingError ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: 4,
            fontSize: '0.875rem',
          }}
        >
          {isInitializing && 'Initializing tracking...'}
          {trackingError && `Tracking error: ${trackingError.message}`}
        </div>
      )}
    </main>
  )
}

export default function HomePage() {
  return (
    <CameraProvider>
      <HomePageContent />
    </CameraProvider>
  )
}
