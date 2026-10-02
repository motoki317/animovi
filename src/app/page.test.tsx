import { describe, it, expect, vi, beforeEach, afterEach, onTestFinished } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import HomePage from './page'
import { updateThumbnail } from '../lib/vrm/vrm-storage'
import type { BackgroundConfig } from '../components/background-settings'

const mocks = vi.hoisted(() => ({
  loader: {
    vrm: null as object | null,
    lastSavedId: null as number | null,
    error: null as Error | null,
  },
  importError: null as Error | null,
  loadFromStorage: vi.fn((_id: number) => Promise.resolve()),
  captureThumbnail: vi.fn(() => Promise.resolve(new Blob(['jpeg']))),
  settings: {} as Record<string, unknown>,
  props: {} as {
    settingsPanel?: { onVRMImport?: (file: File) => void }
    background?: { onChange: (config: BackgroundConfig) => void }
  },
  supported: true,
}))

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
    webgl2: mocks.supported,
    mediaDevices: mocks.supported,
    serviceWorker: true,
    supported: mocks.supported,
    missing: mocks.supported ? [] : ['WebGL2', 'Camera API'],
  }),
}))

vi.mock('../components/avatar-scene', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    AvatarScene: ({ vrm, backgroundImageUrl, ref }: {
      vrm: unknown
      backgroundImageUrl?: string
      ref?: React.Ref<unknown>
    }) => {
      useImperativeHandle(ref, () => ({ captureThumbnail: mocks.captureThumbnail }))
      return (
        <div
          data-testid="avatar-scene"
          data-has-vrm={vrm ? 'true' : 'false'}
          data-background-image-url={backgroundImageUrl}
        />
      )
    },
  }
})

vi.mock('../components/settings-panel', () => ({
  SettingsPanel: (props: typeof mocks.props.settingsPanel) => {
    mocks.props.settingsPanel = props
    return <div data-testid="settings-panel" />
  },
}))

vi.mock('../components/background-settings', () => ({
  BackgroundSettings: (props: typeof mocks.props.background) => {
    mocks.props.background = props
    return <div data-testid="background-settings" />
  },
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
    vrm: mocks.loader.vrm,
    loading: false,
    error: mocks.loader.error,
    // A plain function. A vi.fn() attaches handlers to the promises it returns, which hides unhandled rejections.
    loadFromFile: () => (mocks.importError ? Promise.reject(mocks.importError) : Promise.resolve()),
    loadFromStorage: mocks.loadFromStorage,
    lastSavedId: mocks.loader.lastSavedId,
  }),
}))

vi.mock('../lib/vrm/vrm-storage', () => ({
  listVRMs: vi.fn(() => Promise.resolve([])),
  deleteVRM: vi.fn(() => Promise.resolve()),
  updateThumbnail: vi.fn(() => Promise.resolve()),
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
    backgroundType: 'solid',
    backgroundColor: '#1a1a2e',
    backgroundImageUrl: undefined,
    setBackgroundType: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBackgroundImageUrl: vi.fn(),
    cameraY: 1.3,
    cameraZ: 1.5,
    cameraAutoFrame: true,
    setCameraY: vi.fn(),
    setCameraZ: vi.fn(),
    setCameraAutoFrame: vi.fn(),
    trackingFps: 30,
    drawingFps: 60,
    setTrackingFps: vi.fn(),
    setDrawingFps: vi.fn(),
    panelVisible: true,
    setPanelVisible: vi.fn(),
    togglePanel: vi.fn(),
    lastVrmId: null,
    setLastVrmId: vi.fn(),
    ...mocks.settings,
  }),
}))

vi.mock('../stores/tracking-store', () => {
  const state = {
    debugData: null,
    debugEnabled: false,
    stickFigureEnabled: false,
    setDebugData: vi.fn(),
    setDebugEnabled: vi.fn(),
    setStickFigureEnabled: vi.fn(),
  }
  const useTrackingStore = (selector?: (s: typeof state) => unknown) => {
    return selector ? selector(state) : state
  }
  useTrackingStore.getState = () => state
  return { useTrackingStore }
})

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loader = { vrm: null, lastSavedId: null, error: null }
    mocks.settings = {}
    mocks.props = {}
    mocks.importError = null
    mocks.supported = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('shows the unsupported-browser message when a required feature is missing', () => {
    mocks.supported = false
    render(<HomePage />)

    expect(screen.getByText('Browser Not Supported')).toBeInTheDocument()
    expect(screen.queryByTestId('camera-provider')).not.toBeInTheDocument()
  })

  it('hydrates server HTML without a mismatch', async () => {
    // The server has no document or navigator.mediaDevices, so the support check fails there.
    mocks.supported = false
    const container = document.createElement('div')
    container.innerHTML = renderToString(<HomePage />)
    document.body.appendChild(container)
    onTestFinished(() => container.remove())
    mocks.supported = true

    const onRecoverableError = vi.fn()
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <HomePage />, { onRecoverableError })
    })

    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="avatar-scene"]')).not.toBeNull()
    act(() => root!.unmount())
  })

  it('shows a VRM load error as an alert', () => {
    mocks.loader.error = new Error('File does not contain VRM data. Please provide a valid VRM file.')
    render(<HomePage />)

    expect(screen.getByRole('alert')).toHaveTextContent('File does not contain VRM data')
  })

  it('ignores shortcut keys pressed with a modifier', () => {
    render(<HomePage />)
    const perfToggle = screen.getByRole('checkbox', { name: 'Performance (P)' }) as HTMLInputElement

    fireEvent.keyDown(window, { key: 'p', metaKey: true })
    expect(perfToggle.checked).toBe(false)
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    expect(perfToggle.checked).toBe(false)

    fireEvent.keyDown(window, { key: 'p' })
    expect(perfToggle.checked).toBe(true)
  })

  it('captures a thumbnail from the avatar scene for each newly saved VRM', async () => {
    mocks.loader = { vrm: { name: 'a' }, lastSavedId: 1, error: null }
    const { rerender } = render(<HomePage />)
    await waitFor(() => expect(updateThumbnail).toHaveBeenCalledWith(1, expect.any(Blob)))
    expect(mocks.captureThumbnail).toHaveBeenCalledTimes(1)

    // An imported VRM renders before its save finishes, so lastSavedId still names the previous VRM.
    const vrmB = { name: 'b' }
    mocks.loader = { vrm: vrmB, lastSavedId: 1, error: null }
    rerender(<HomePage />)
    mocks.loader = { vrm: vrmB, lastSavedId: 2, error: null }
    rerender(<HomePage />)

    await waitFor(() => expect(updateThumbnail).toHaveBeenCalledWith(2, expect.any(Blob)))
    expect(updateThumbnail).toHaveBeenCalledTimes(2)
  })

  it('handles a failed VRM import without an unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    onTestFinished(() => {
      process.off('unhandledRejection', unhandled)
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.importError = new Error('File does not contain VRM data.')
    render(<HomePage />)

    // Braces discard the return value. act() would attach a handler to a returned promise.
    act(() => {
      mocks.props.settingsPanel!.onVRMImport!(new File(['x'], 'bad.vrm'))
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(unhandled).not.toHaveBeenCalled()
  })

  it('warns and forgets the last VRM when the startup load fails', async () => {
    const failure = new Error('VRM 7 not found')
    const setLastVrmId = vi.fn()
    mocks.settings = { lastVrmId: 7, setLastVrmId }
    mocks.loadFromStorage.mockRejectedValueOnce(failure)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<HomePage />)

    await waitFor(() => expect(warn).toHaveBeenCalledWith(expect.any(String), failure))
    expect(setLastVrmId).toHaveBeenCalledWith(null)
  })

  it('passes the image background URL to the avatar scene', () => {
    mocks.settings = { backgroundType: 'image', backgroundImageUrl: 'blob:http://localhost/bg' }
    render(<HomePage />)

    expect(screen.getByTestId('avatar-scene'))
      .toHaveAttribute('data-background-image-url', 'blob:http://localhost/bg')
  })

  it('revokes the previous background image URL when the image changes', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:http://localhost/one')
      .mockReturnValueOnce('blob:http://localhost/two')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    render(<HomePage />)

    act(() => {
      mocks.props.background!.onChange({ type: 'image', imageFile: new File(['a'], 'a.png') })
    })
    expect(revoke).not.toHaveBeenCalled()
    act(() => {
      mocks.props.background!.onChange({ type: 'image', imageFile: new File(['b'], 'b.png') })
    })

    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/one')
  })
})
