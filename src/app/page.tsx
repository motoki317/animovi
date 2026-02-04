'use client'

/**
 * HomePage - Main application page integrating all components.
 */

import { CameraProvider } from '../components/camera-provider'
import { AvatarScene } from '../components/avatar-scene'
import { SettingsPanel } from '../components/settings-panel'
import { useVRMLoader } from '../hooks/use-vrm-loader'
import { useSettingsStore } from '../stores/settings-store'
import { useTrackingStore } from '../stores/tracking-store'

export default function HomePage() {
  const { vrm } = useVRMLoader()
  const settings = useSettingsStore()
  const _tracking = useTrackingStore()

  return (
    <CameraProvider>
      <main style={{ display: 'flex', height: '100vh' }}>
        <div style={{ flex: 1 }}>
          <AvatarScene vrm={vrm} />
        </div>
        <aside style={{ width: '300px', borderLeft: '1px solid #333' }}>
          <SettingsPanel
            smoothing={settings.smoothing}
            onSmoothingChange={settings.setSmoothing}
            faceTrackingEnabled={settings.faceTrackingEnabled}
            onFaceTrackingChange={settings.setFaceTrackingEnabled}
            poseTrackingEnabled={settings.poseTrackingEnabled}
            onPoseTrackingChange={settings.setPoseTrackingEnabled}
            handTrackingEnabled={settings.handTrackingEnabled}
            onHandTrackingChange={settings.setHandTrackingEnabled}
          />
        </aside>
      </main>
    </CameraProvider>
  )
}
