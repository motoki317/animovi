'use client'

/**
 * HomePage - Main application page integrating all components.
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { CameraProvider, useCamera } from '../components/camera-provider'
import { AvatarScene } from '../components/avatar-scene'
import { SettingsPanel } from '../components/settings-panel'
import { BackgroundSettings, type BackgroundConfig } from '../components/background-settings'
import { TrackingDebugOverlay } from '../components/tracking-debug-overlay'
import { TrackingStickfigureOverlay } from '../components/tracking-stickfigure-overlay'
import { PerformanceOverlay, type RendererInfo } from '../components/performance-overlay'
import { useVRMLoader } from '../hooks/use-vrm-loader'
import { useVRMTracking } from '../hooks/use-vrm-tracking'
import { useSettingsStore } from '../stores/settings-store'
import { useTrackingStore } from '../stores/tracking-store'
import { checkBrowserSupport } from '../lib/compat/browser-support'
import { listVRMs, deleteVRM as deleteVRMFromDB, updateThumbnail } from '../lib/vrm/vrm-storage'
import { captureThumbnail } from '../lib/vrm/vrm-thumbnail'
import type { VRMMeta } from '../lib/vrm/vrm-storage'

function HomePageContent() {
  const browserSupport = useMemo(() => checkBrowserSupport(), [])
  const { vrm, loading: vrmLoading, loadFromFile, loadFromStorage, lastSavedId } = useVRMLoader()
  const settings = useSettingsStore()
  const [storedVRMs, setStoredVRMs] = useState<VRMMeta[]>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const thumbnailCapturedRef = useRef(false)
  const { stream } = useCamera()
  const debugEnabled = useTrackingStore((s) => s.debugEnabled)
  const setDebugEnabled = useTrackingStore((s) => s.setDebugEnabled)
  const stickFigureEnabled = useTrackingStore((s) => s.stickFigureEnabled)
  const setStickFigureEnabled = useTrackingStore((s) => s.setStickFigureEnabled)
  const [perfVisible, setPerfVisible] = useState(false)
  const [rendererInfo, setRendererInfo] = useState<RendererInfo | null>(null)

  // Video element for tracking
  const videoRef = useRef<HTMLVideoElement>(null)

  // Connect camera stream to video element.
  // Perf-debug override: `?footage=<url>` (or `?footage=1` for the default path)
  // feeds a looping local video file into the same hidden <video> the tracking
  // loop reads via createImageBitmap, replacing the live camera. This makes
  // MediaPipe input deterministic so CPU/GPU A/B measurements are reproducible
  // across runs (a live person moves differently each take). No effect unless
  // the query param is present, so it is inert in normal use.
  useEffect(() => {
    if (!videoRef.current) return
    const footage = new URLSearchParams(window.location.search).get('footage')
    if (footage) {
      const v = videoRef.current
      v.srcObject = null
      v.src = footage === '1' ? '/__perf_footage.webm' : footage
      v.loop = true
      v.muted = true
      v.play().catch(() => {})
      return
    }
    if (stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, that's ok
      })
    }
  }, [stream])

  // Use VRM tracking
  const { isTracking, isInitializing, isWaitingForVideo, error: trackingError } = useVRMTracking({
    vrm,
    videoRef,
    stream, // Pass stream so tracking can initialize when camera becomes available
    enabled: settings.faceTrackingEnabled || settings.poseTrackingEnabled || settings.handTrackingEnabled,
    smoothing: settings.smoothing,
    targetFps: settings.trackingFps,
    faceTracking: settings.faceTrackingEnabled,
    poseTracking: settings.poseTrackingEnabled,
    handTracking: settings.handTrackingEnabled,
  })

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // H key to toggle panel
      if (e.key === 'h' || e.key === 'H') {
        settings.togglePanel()
      }

      // D key to toggle debug overlay
      if (e.key === 'd' || e.key === 'D') {
        setDebugEnabled(!debugEnabled)
      }

      // P key to toggle performance overlay
      if (e.key === 'p' || e.key === 'P') {
        setPerfVisible((prev) => !prev)
      }

      // S key to toggle stick-figure debug overlay
      if (e.key === 's' || e.key === 'S') {
        setStickFigureEnabled(!stickFigureEnabled)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settings, debugEnabled, setDebugEnabled, stickFigureEnabled, setStickFigureEnabled])

  // Refresh stored VRMs list
  const refreshStoredVRMs = useCallback(() => {
    listVRMs()
      .then(setStoredVRMs)
      .catch(console.warn)
  }, [])

  // Auto-load last used VRM on mount
  useEffect(() => {
    const lastVrmId = settings.lastVrmId
    if (lastVrmId != null) {
      loadFromStorage(lastVrmId).catch(() => {
        // VRM missing or corrupted — clear and fall back to import UI
        settings.setLastVrmId(null)
      })
    }
    refreshStoredVRMs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Update lastVrmId and refresh gallery after a save
  useEffect(() => {
    if (lastSavedId != null) {
      settings.setLastVrmId(lastSavedId)
      refreshStoredVRMs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSavedId])

  // Capture thumbnail after VRM loads (once per VRM load)
  useEffect(() => {
    if (vrm && lastSavedId != null && !thumbnailCapturedRef.current) {
      thumbnailCapturedRef.current = true
      // Wait a frame for the VRM to render
      requestAnimationFrame(() => {
        const canvas = canvasRef.current ?? document.querySelector('canvas')
        if (canvas) {
          captureThumbnail(canvas)
            .then((blob) => updateThumbnail(lastSavedId, blob))
            .then(refreshStoredVRMs)
            .catch(console.warn)
        }
      })
    }
    if (!vrm) {
      thumbnailCapturedRef.current = false
    }
  }, [vrm, lastSavedId, refreshStoredVRMs])

  // Handle gallery VRM selection
  const handleVRMSelect = useCallback(
    (id: number) => {
      thumbnailCapturedRef.current = false
      loadFromStorage(id)
        .then(() => settings.setLastVrmId(id))
        .catch(console.warn)
    },
    [loadFromStorage, settings]
  )

  // Handle gallery VRM deletion
  const handleVRMDelete = useCallback(
    (id: number) => {
      deleteVRMFromDB(id)
        .then(() => {
          if (settings.lastVrmId === id) {
            settings.setLastVrmId(null)
          }
          refreshStoredVRMs()
        })
        .catch(console.warn)
    },
    [settings, refreshStoredVRMs]
  )

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

  if (!browserSupport.supported) {
    return (
      <main style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Browser Not Supported</h1>
          <p style={{ color: '#aaa', marginBottom: '1rem' }}>
            Animovi requires the following features that your browser does not support:
          </p>
          <ul style={{ textAlign: 'left', color: '#f87171', listStyle: 'none', padding: 0 }}>
            {browserSupport.missing.map((feature) => (
              <li key={feature} style={{ marginBottom: '0.5rem' }}>
                {feature}
              </li>
            ))}
          </ul>
          <p style={{ color: '#888', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            Please use a recent version of Chrome, Edge, or Firefox.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
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

      {/* Avatar scene - always full window size, character centered */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <AvatarScene
          vrm={vrm}
          backgroundType={settings.backgroundType}
          backgroundColor={settings.backgroundColor}
          cameraY={settings.cameraY}
          cameraZ={settings.cameraZ}
          autoFrameOnLoad={settings.cameraAutoFrame}
          onAutoFrame={handleAutoFrame}
          drawingFps={settings.drawingFps}
          onRendererInfo={setRendererInfo}
        />
      </div>

      {/* Settings panel - overlay on right side */}
      {settings.panelVisible && (
        <aside
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '300px',
            background: '#1a1a1a',
            borderLeft: '1px solid #333',
            overflowY: 'auto',
            transition: 'transform 0.3s ease-in-out',
            zIndex: 10,
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
              trackingFps={settings.trackingFps}
              onTrackingFpsChange={settings.setTrackingFps}
              drawingFps={settings.drawingFps}
              onDrawingFpsChange={settings.setDrawingFps}
              onVRMImport={loadFromFile}
              vrmLoading={vrmLoading}
              storedVRMs={storedVRMs}
              activeVrmId={settings.lastVrmId}
              onVRMSelect={handleVRMSelect}
              onVRMDelete={handleVRMDelete}
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

            {/* Debug Overlays */}
            <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #444' }}>
              <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Debug Overlays</h4>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <input
                  type="checkbox"
                  checked={debugEnabled}
                  onChange={(e) => setDebugEnabled(e.target.checked)}
                />
                {' '}Tracking debug (D)
              </label>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                <input
                  type="checkbox"
                  checked={perfVisible}
                  onChange={(e) => setPerfVisible(e.target.checked)}
                />
                {' '}Performance (P)
              </label>
              <label style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={stickFigureEnabled}
                  onChange={(e) => setStickFigureEnabled(e.target.checked)}
                />
                {' '}Stick figure (S)
              </label>
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
                Shortcuts: H panel · D debug · P perf · S stick
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
            zIndex: 10,
          }}
          title="Show settings panel"
        />
      )}

      {/* Performance overlay - toggle with 'P' key */}
      <PerformanceOverlay visible={perfVisible} rendererInfo={rendererInfo} />

      {/* Debug overlay - toggle with 'D' key */}
      <TrackingDebugOverlay />

      {/* Stick-figure debug overlay - toggle with 'S' key */}
      <TrackingStickfigureOverlay vrm={vrm} />

      {/* Tracking status indicator */}
      {(isInitializing || isWaitingForVideo || trackingError) && (
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
            zIndex: 5,
          }}
        >
          {isInitializing && 'Initializing tracking...'}
          {isWaitingForVideo && 'Waiting for camera...'}
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
