/**
 * jsdom has no WebGL context, so these tests mock WebGLRenderer, OrbitControls, and
 * the skeleton renderer. They check the React wiring and the GPU resource lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StrictMode } from 'react'
import { useTrackingStore } from '../stores/tracking-store'

vi.mock('three/addons/controls/OrbitControls.js', () => {
  class MockOrbitControls {
    enableDamping = true
    enablePan = false
    enabled = true
    update = vi.fn()
    dispose = vi.fn()
  }
  return { OrbitControls: MockOrbitControls }
})

vi.mock('../lib/debug/skeleton-renderer', () => ({
  createSkeletonRenderer: vi.fn(() => ({
    group: {
      add: vi.fn(),
      scale: { setScalar: vi.fn() },
    },
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}))

const rendererInstances = vi.hoisted(
  () => [] as { domElement: HTMLCanvasElement; dispose: () => void; forceContextLoss: () => void }[],
)

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class MockWebGLRenderer {
    domElement = document.createElement('canvas')
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
    forceContextLoss = vi.fn()

    constructor() {
      rendererInstances.push(this)
    }
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  }
})

import { TrackingStickfigureOverlay } from './tracking-stickfigure-overlay'

describe('TrackingStickfigureOverlay', () => {
  beforeEach(() => {
    useTrackingStore.setState({
      stickFigureEnabled: false,
      debugData: null,
    })
    cleanup()
  })

  it('renders nothing when stickFigureEnabled is false', () => {
    const { container } = render(<TrackingStickfigureOverlay vrm={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the overlay when stickFigureEnabled is true', () => {
    useTrackingStore.getState().setStickFigureEnabled(true)
    render(<TrackingStickfigureOverlay vrm={null} />)
    expect(screen.getByText('Stick Figure Debug')).toBeInTheDocument()
    expect(screen.getByText(/MediaPipe \(raw\)/)).toBeInTheDocument()
    expect(screen.getByText(/VRM \(applied\)/)).toBeInTheDocument()
  })

  it('Close button toggles stickFigureEnabled off', () => {
    useTrackingStore.getState().setStickFigureEnabled(true)
    render(<TrackingStickfigureOverlay vrm={null} />)

    const closeButton = screen.getByRole('button', { name: /close stick figure debug/i })
    fireEvent.click(closeButton)

    expect(useTrackingStore.getState().stickFigureEnabled).toBe(false)
  })

  it('shows shortcut reference', () => {
    useTrackingStore.getState().setStickFigureEnabled(true)
    render(<TrackingStickfigureOverlay vrm={null} />)
    expect(screen.getByText(/H panel · D debug · P perf · S stick/)).toBeInTheDocument()
  })

  it('shows interaction help (rotate / zoom / pan)', () => {
    useTrackingStore.getState().setStickFigureEnabled(true)
    render(<TrackingStickfigureOverlay vrm={null} />)
    expect(screen.getByText(/Drag to rotate · scroll to zoom · right-drag to pan/)).toBeInTheDocument()
  })
})

describe('TrackingStickfigureOverlay GPU lifecycle', () => {
  beforeEach(() => {
    cleanup()
    rendererInstances.length = 0
    useTrackingStore.setState({ stickFigureEnabled: true, debugData: null })
  })

  it('renders with live renderers after a StrictMode remount', () => {
    render(
      <StrictMode>
        <TrackingStickfigureOverlay vrm={null} />
      </StrictMode>
    )

    const canvases = [...document.querySelectorAll('canvas')]
    expect(canvases).toHaveLength(2)
    for (const canvas of canvases) {
      const owner = rendererInstances.find((r) => r.domElement === canvas)
      expect(owner?.dispose).not.toHaveBeenCalled()
    }
  })

  it('releases every WebGL context on close', () => {
    const { unmount } = render(<TrackingStickfigureOverlay vrm={null} />)
    unmount()

    expect(rendererInstances.length).toBeGreaterThan(0)
    for (const renderer of rendererInstances) {
      expect(renderer.forceContextLoss).toHaveBeenCalled()
    }
  })
})
