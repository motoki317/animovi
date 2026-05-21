/**
 * Smoke tests for the stick-figure debug overlay.
 *
 * We can't meaningfully render the Three.js scene in jsdom (no WebGL context),
 * so the renderer module and Three.js's WebGLRenderer are mocked away. These
 * tests check the React wiring: the overlay hides when disabled, mounts when
 * enabled, and the Close button flips the store flag.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useTrackingStore } from '../stores/tracking-store'

// Mock the Three.js OrbitControls addon — it touches DOM APIs (pointer events,
// PointerLock) that don't survive jsdom cleanly. Constructable class form so
// `new OrbitControls(...)` doesn't blow up.
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

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class MockWebGLRenderer {
    // One canvas per renderer — there are two renderers per overlay instance,
    // so each call to `new WebGLRenderer()` must return a fresh canvas.
    domElement = document.createElement('canvas')
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
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
