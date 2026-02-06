import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

// Mock components
vi.mock('../components/camera-provider', () => ({
  CameraProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="camera-provider">{children}</div>
  ),
  useCamera: () => ({
    stream: null,
    error: null,
    isLoading: false,
    switchCamera: vi.fn(),
    devices: [],
  }),
}))

vi.mock('../lib/compat/browser-support', () => ({
  checkBrowserSupport: () => ({
    webgl2: true,
    mediaDevices: true,
    serviceWorker: true,
    supported: true,
    missing: [],
  }),
}))

vi.mock('../components/avatar-scene', () => ({
  AvatarScene: ({ vrm }: { vrm: unknown }) => (
    <div data-testid="avatar-scene" data-has-vrm={vrm ? 'true' : 'false'} />
  ),
}))

vi.mock('../components/settings-panel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
}))

vi.mock('../components/background-settings', () => ({
  BackgroundSettings: () => <div data-testid="background-settings" />,
}))

vi.mock('../components/tracking-debug-overlay', () => ({
  TrackingDebugOverlay: () => <div data-testid="tracking-debug-overlay" />,
}))

vi.mock('../components/performance-overlay', () => ({
  PerformanceOverlay: () => <div data-testid="performance-overlay" />,
}))

vi.mock('../hooks/use-vrm-tracking', () => ({
  useVRMTracking: () => ({
    isTracking: false,
    isInitializing: false,
    isWaitingForVideo: false,
    error: null,
  }),
}))

vi.mock('../hooks/use-vrm-loader', () => ({
  useVRMLoader: () => ({
    vrm: null,
    loading: false,
    error: null,
    loadFromUrl: vi.fn(),
    loadFromFile: vi.fn(),
  }),
}))

vi.mock('../stores/settings-store', () => ({
  useSettingsStore: () => ({
    // Tracking settings
    smoothing: 0.5,
    faceTrackingEnabled: true,
    poseTrackingEnabled: true,
    handTrackingEnabled: false,
    setSmoothing: vi.fn(),
    setFaceTrackingEnabled: vi.fn(),
    setPoseTrackingEnabled: vi.fn(),
    setHandTrackingEnabled: vi.fn(),
    // Background settings
    backgroundType: 'solid',
    backgroundColor: '#1a1a2e',
    backgroundImageUrl: undefined,
    setBackgroundType: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBackgroundImageUrl: vi.fn(),
    // Camera settings
    cameraY: 1.3,
    cameraZ: 1.5,
    cameraAutoFrame: true,
    setCameraY: vi.fn(),
    setCameraZ: vi.fn(),
    setCameraAutoFrame: vi.fn(),
    // FPS settings
    trackingFps: 30,
    drawingFps: 60,
    setTrackingFps: vi.fn(),
    setDrawingFps: vi.fn(),
    // Panel visibility
    panelVisible: true,
    setPanelVisible: vi.fn(),
    togglePanel: vi.fn(),
  }),
}))

vi.mock('../stores/tracking-store', () => {
  const state = {
    isTracking: false,
    result: null,
    debugData: null,
    debugEnabled: false,
    setTracking: vi.fn(),
    setResult: vi.fn(),
    setDebugData: vi.fn(),
    setDebugEnabled: vi.fn(),
  }
  const useTrackingStore = (selector?: (state: typeof state) => unknown) => {
    return selector ? selector(state) : state
  }
  useTrackingStore.getState = () => state
  return { useTrackingStore }
})

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render AvatarScene component', () => {
    render(<HomePage />)

    expect(screen.getByTestId('avatar-scene')).toBeInTheDocument()
  })

  it('should render SettingsPanel component', () => {
    render(<HomePage />)

    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
  })

  it('should wrap content in CameraProvider', () => {
    render(<HomePage />)

    expect(screen.getByTestId('camera-provider')).toBeInTheDocument()
  })

  it('should render BackgroundSettings component', () => {
    render(<HomePage />)

    expect(screen.getByTestId('background-settings')).toBeInTheDocument()
  })
})
