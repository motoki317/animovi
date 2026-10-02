'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { CameraProvider, useCamera } from '../components/camera-provider'
import { AvatarScene, type AvatarSceneHandle } from '../components/avatar-scene'
import { SettingsPanel } from '../components/settings-panel'
import { BackgroundSettings, type BackgroundConfig } from '../components/background-settings'
import { TrackingDebugOverlay } from '../components/tracking-debug-overlay'
import { TrackingStickfigureOverlay } from '../components/tracking-stickfigure-overlay'
import { PerformanceOverlay, type RendererInfo } from '../components/performance-overlay'
import { useVRMLoader } from '../hooks/use-vrm-loader'
import { useVRMTracking } from '../hooks/use-vrm-tracking'
import { useSettingsStore } from '../stores/settings-store'
import { useTrackingStore } from '../stores/tracking-store'
import { checkBrowserSupport, type BrowserSupport } from '../lib/compat/browser-support'
import { listVRMs, deleteVRM as deleteVRMFromDB, updateThumbnail } from '../lib/vrm/vrm-storage'
import type { VRMMeta } from '../lib/vrm/vrm-storage'

function HomePageContent() {
  const {
    vrm,
    loading: vrmLoading,
    error: vrmError,
    loadFromFile,
    loadFromStorage,
    lastSavedId,
  } = useVRMLoader()
  const settings = useSettingsStore()
  const [storedVRMs, setStoredVRMs] = useState<VRMMeta[]>([])
  const thumbnailSavedIdRef = useRef<number | null>(null)
  const avatarSceneRef = useRef<AvatarSceneHandle>(null)
  const backgroundObjectUrlRef = useRef<string | null>(null)
  const { stream } = useCamera()
  const debugEnabled = useTrackingStore((s) => s.debugEnabled)
  const setDebugEnabled = useTrackingStore((s) => s.setDebugEnabled)
  const stickFigureEnabled = useTrackingStore((s) => s.stickFigureEnabled)
  const setStickFigureEnabled = useTrackingStore((s) => s.setStickFigureEnabled)
  const [perfVisible, setPerfVisible] = useState(false)
  const [rendererInfo, setRendererInfo] = useState<RendererInfo | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Perf harness: `?footage=<url>` (`?footage=1` means /__perf_footage.webm) plays a
  // looping video in place of the camera. The same input on every run makes CPU and
  // GPU A/B measurements comparable.
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
      // The browser can block autoplay.
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  const { isInitializing, isWaitingForVideo, error: trackingError } = useVRMTracking({
    vrm,
    videoRef,
    stream,
    enabled: settings.faceTrackingEnabled || settings.poseTrackingEnabled || settings.handTrackingEnabled,
    smoothing: settings.smoothing,
    targetFps: settings.trackingFps,
    faceTracking: settings.faceTrackingEnabled,
    poseTracking: settings.poseTrackingEnabled,
    handTracking: settings.handTrackingEnabled,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      // Leave browser shortcuts such as Cmd+P (print) and Ctrl+D (bookmark) alone.
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'h' || e.key === 'H') {
        settings.togglePanel()
      }
      if (e.key === 'd' || e.key === 'D') {
        setDebugEnabled(!debugEnabled)
      }
      if (e.key === 'p' || e.key === 'P') {
        setPerfVisible((prev) => !prev)
      }
      if (e.key === 's' || e.key === 'S') {
        setStickFigureEnabled(!stickFigureEnabled)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settings, debugEnabled, setDebugEnabled, stickFigureEnabled, setStickFigureEnabled])

  const refreshStoredVRMs = useCallback(() => {
    listVRMs()
      .then(setStoredVRMs)
      .catch(console.warn)
  }, [])

  // Mount only. `settings` changes identity on every store write, and a rerun reloads the VRM.
  useEffect(() => {
    const lastVrmId = settings.lastVrmId
    if (lastVrmId != null) {
      loadFromStorage(lastVrmId).catch((error) => {
        console.warn('Could not load the last VRM:', error)
        // The stored VRM is missing or unreadable. Forget it so that later starts skip it.
        settings.setLastVrmId(null)
      })
    }
    refreshStoredVRMs()
  }, [])

  // Omits `settings`, which changes identity on every store write. This effect
  // writes the store, so that dependency would rerun it in a loop.
  useEffect(() => {
    if (lastSavedId != null) {
      settings.setLastVrmId(lastSavedId)
      refreshStoredVRMs()
    }
  }, [lastSavedId])

  // Key the capture on lastSavedId, not on vrm. A file import shows the new VRM
  // before its save assigns an ID, so `lastSavedId` still names the previous VRM then.
  useEffect(() => {
    if (!vrm || lastSavedId == null || thumbnailSavedIdRef.current === lastSavedId) return
    thumbnailSavedIdRef.current = lastSavedId
    // AvatarScene's effects run before this one, so its scene already holds `vrm`.
    avatarSceneRef.current?.captureThumbnail()
      .then((blob) => updateThumbnail(lastSavedId, blob))
      .then(refreshStoredVRMs)
      .catch(console.warn)
  }, [vrm, lastSavedId, refreshStoredVRMs])

  const handleVRMImport = useCallback(
    (file: File) => {
      // The page renders the loader's error in its role="alert" element.
      loadFromFile(file).catch(console.warn)
    },
    [loadFromFile]
  )

  const handleVRMSelect = useCallback(
    (id: number) => {
      loadFromStorage(id)
        .then(() => settings.setLastVrmId(id))
        .catch(console.warn)
    },
    [loadFromStorage, settings]
  )

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

  const {
    setBackgroundType,
    setBackgroundColor,
    setBackgroundImageUrl,
    setCameraY,
    setCameraZ,
  } = settings

  const handleBackgroundChange = useCallback((config: BackgroundConfig) => {
    setBackgroundType(config.type)
    if (config.color) {
      setBackgroundColor(config.color)
    }
    if (config.imageFile) {
      const url = URL.createObjectURL(config.imageFile)
      if (backgroundObjectUrlRef.current) {
        URL.revokeObjectURL(backgroundObjectUrlRef.current)
      }
      backgroundObjectUrlRef.current = url
      setBackgroundImageUrl(url)
    } else if (config.imageUrl) {
      setBackgroundImageUrl(config.imageUrl)
    }
  }, [setBackgroundType, setBackgroundColor, setBackgroundImageUrl])

  const handleAutoFrame = useCallback((y: number, z: number) => {
    setCameraY(y)
    setCameraZ(z)
  }, [setCameraY, setCameraZ])

  return (
    <main style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
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

      <div style={{ position: 'absolute', inset: 0 }}>
        <AvatarScene
          ref={avatarSceneRef}
          vrm={vrm}
          backgroundType={settings.backgroundType}
          backgroundColor={settings.backgroundColor}
          backgroundImageUrl={settings.backgroundImageUrl}
          cameraY={settings.cameraY}
          cameraZ={settings.cameraZ}
          autoFrameOnLoad={settings.cameraAutoFrame}
          onAutoFrame={handleAutoFrame}
          drawingFps={settings.drawingFps}
          onRendererInfo={setRendererInfo}
        />
      </div>

      {/* An overlay, not a flex sibling, so the avatar stays centered in the full window. */}
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
              onVRMImport={handleVRMImport}
              vrmLoading={vrmLoading}
              storedVRMs={storedVRMs}
              activeVrmId={settings.lastVrmId}
              onVRMSelect={handleVRMSelect}
              onVRMDelete={handleVRMDelete}
            />

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

      <PerformanceOverlay visible={perfVisible} rendererInfo={rendererInfo} />

      <TrackingDebugOverlay />

      <TrackingStickfigureOverlay vrm={vrm} />

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

      {vrmError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.5rem 1rem',
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            borderRadius: 4,
            fontSize: '0.875rem',
            zIndex: 5,
          }}
        >
          {`VRM load error: ${vrmError.message}`}
        </div>
      )}
    </main>
  )
}

export default function HomePage() {
  // Check support after mount. The server has no browser APIs, so a check during
  // render puts "Browser Not Supported" in the server HTML and breaks hydration.
  const [browserSupport, setBrowserSupport] = useState<BrowserSupport | null>(null)
  useEffect(() => {
    setBrowserSupport(checkBrowserSupport())
  }, [])

  if (!browserSupport) return null

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
    <CameraProvider>
      <HomePageContent />
    </CameraProvider>
  )
}
