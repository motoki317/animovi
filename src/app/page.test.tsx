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

vi.mock('../components/avatar-scene', () => ({
  AvatarScene: ({ vrm }: { vrm: unknown }) => (
    <div data-testid="avatar-scene" data-has-vrm={vrm ? 'true' : 'false'} />
  ),
}))

vi.mock('../components/settings-panel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
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
    smoothing: 0.5,
    faceTrackingEnabled: true,
    poseTrackingEnabled: true,
    handTrackingEnabled: false,
    setSmoothing: vi.fn(),
    setFaceTrackingEnabled: vi.fn(),
    setPoseTrackingEnabled: vi.fn(),
    setHandTrackingEnabled: vi.fn(),
  }),
}))

vi.mock('../stores/tracking-store', () => ({
  useTrackingStore: () => ({
    isTracking: false,
    result: null,
    setTracking: vi.fn(),
    setResult: vi.fn(),
  }),
}))

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
})
