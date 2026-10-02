'use client'

/**
 * Two 3D stick figures side by side: the raw MediaPipe landmarks, and the live
 * VRM bone positions. A difference between them shows whether an error starts
 * in tracking or later, in the solver, clamps, or smoothing.
 *
 * Each pane has its own WebGLRenderer, camera, and OrbitControls, so the user
 * can rotate each pane on its own.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { VRM } from '@pixiv/three-vrm'
import { useTrackingStore } from '../stores/tracking-store'
import {
  buildAppliedSkeleton,
  buildRawSkeleton,
} from '../lib/debug/skeleton-builder'
import { createSkeletonRenderer } from '../lib/debug/skeleton-renderer'

const PANE_WIDTH = 200
const PANE_HEIGHT = 200
/**
 * Skeleton units are shoulder widths, and outstretched arms span about 3 units.
 * The pane camera (35° FOV, about 3 units away) shows about 1.9 units vertically.
 * Half scale leaves headroom for raised arms.
 */
const SKELETON_SCALE = 0.5

export interface TrackingStickfigureOverlayProps {
  /** The right pane reads the applied bone rotations from this VRM. */
  vrm: VRM | null
}

export function TrackingStickfigureOverlay({ vrm }: TrackingStickfigureOverlayProps) {
  const enabled = useTrackingStore((s) => s.stickFigureEnabled)
  const setEnabled = useTrackingStore((s) => s.setStickFigureEnabled)

  if (!enabled) return null

  return <StickfigureOverlayInner vrm={vrm} onClose={() => setEnabled(false)} />
}

interface InnerProps {
  vrm: VRM | null
  onClose: () => void
}

function StickfigureOverlayInner({ vrm, onClose }: InnerProps) {
  const rawPaneRef = useRef<HTMLDivElement>(null)
  const appliedPaneRef = useRef<HTMLDivElement>(null)
  // The frame loop starts once, so it reads the current VRM through a ref.
  const vrmRef = useRef(vrm)
  vrmRef.current = vrm

  useEffect(() => {
    const rawPane = rawPaneRef.current
    const appliedPane = appliedPaneRef.current
    if (!rawPane || !appliedPane) return
    // Create the GPU resources here, not during render, so that each setup has
    // its own cleanup. StrictMode runs setup, cleanup, and setup again on mount.
    const sceneSetup = createSceneSetup()
    rawPane.appendChild(sceneSetup.rawCanvas)
    appliedPane.appendChild(sceneSetup.appliedCanvas)

    let rafId: number | null = null
    const loop = () => {
      const debugData = useTrackingStore.getState().debugData
      sceneSetup.applyFrame(debugData?.rawLandmarks, debugData?.appliedRotations, vrmRef.current)
      sceneSetup.render()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      sceneSetup.rawCanvas.remove()
      sceneSetup.appliedCanvas.remove()
      sceneSetup.dispose()
    }
  }, [])

  // The frame loop reads the store directly. This subscription re-renders the table.
  const debugData = useTrackingStore((s) => s.debugData)
  const hasRawPose = !!(debugData?.rawLandmarks?.pose && debugData.rawLandmarks.pose.length > 0)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        left: 10,
        zIndex: 9998, // below the text debug overlay (9999)
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '11px',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(6px)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <strong>Stick Figure Debug</strong>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '3px',
            cursor: 'pointer',
            padding: '2px 8px',
            fontSize: '10px',
          }}
          aria-label="Close stick figure debug"
        >
          Close (S)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <PaneLabel label="MediaPipe (raw)" color="#4ade80" width={PANE_WIDTH} />
        <PaneLabel label="VRM (applied)" color="#f59e0b" width={PANE_WIDTH} />
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <div style={{ position: 'relative' }}>
          <div
            ref={rawPaneRef}
            style={{
              width: `${PANE_WIDTH}px`,
              height: `${PANE_HEIGHT}px`,
              background: '#0a0a14',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          />
          {!hasRawPose && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '10px',
                pointerEvents: 'none',
                textAlign: 'center',
                padding: '0 12px',
              }}
            >
              Waiting for raw pose landmarks…<br />
              <span style={{ color: '#444' }}>(toggle Pose Tracking on, stand in frame)</span>
            </div>
          )}
        </div>
        <div
          ref={appliedPaneRef}
          style={{
            width: `${PANE_WIDTH}px`,
            height: `${PANE_HEIGHT}px`,
            background: '#14140a',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        />
      </div>

      <RotationDiffTable applied={debugData?.appliedRotations} />

      <div style={{ marginTop: '6px', fontSize: '10px', color: '#888' }}>
        Drag to rotate · scroll to zoom · right-drag to pan
      </div>
      <div style={{ marginTop: '2px', fontSize: '10px', color: '#888' }}>
        Shortcuts: H panel · D debug · P perf · S stick
      </div>
    </div>
  )
}

function PaneLabel({ label, color, width }: { label: string; color: string; width: number }) {
  return (
    <div style={{ width, textAlign: 'center', color, fontSize: '10px' }}>
      ● {label}
    </div>
  )
}

const JOINTS_TO_SHOW = [
  { display: 'L.Shoulder', key: 'leftUpperArm' },
  { display: 'L.Elbow', key: 'leftLowerArm' },
  { display: 'R.Shoulder', key: 'rightUpperArm' },
  { display: 'R.Elbow', key: 'rightLowerArm' },
  { display: 'Spine', key: 'spine' },
  { display: 'Head', key: 'head' },
] as const

function RotationDiffTable({
  applied,
}: {
  applied: import('../lib/vrm/tracking-bridge').AppliedRotations | undefined
}) {
  if (!applied) {
    return (
      <div style={{ marginTop: '6px', color: '#888', fontSize: '10px' }}>
        Waiting for tracking data…
      </div>
    )
  }
  const rad = (n: number) => `${(n * 180 / Math.PI).toFixed(0)}°`
  const cellStyle: React.CSSProperties = {
    padding: '0 4px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    minWidth: '28px',
  }
  const headerStyle: React.CSSProperties = { ...cellStyle, color: '#888', fontWeight: 'normal' }
  return (
    <table style={{ marginTop: '6px', borderCollapse: 'collapse', fontSize: '10px' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', paddingRight: '6px', color: '#888', fontWeight: 'normal' }}>Joint</th>
          <th style={headerStyle}>raw X</th>
          <th style={headerStyle}>app X</th>
          <th style={headerStyle}>raw Y</th>
          <th style={headerStyle}>app Y</th>
          <th style={headerStyle}>raw Z</th>
          <th style={headerStyle}>app Z</th>
        </tr>
      </thead>
      <tbody>
        {JOINTS_TO_SHOW.map(({ display, key }) => {
          const rot = applied[key]
          if (!rot) {
            return (
              <tr key={key}>
                <td style={{ paddingRight: '6px' }}>{display}</td>
                <td colSpan={6} style={{ ...cellStyle, color: '#555' }}>—</td>
              </tr>
            )
          }
          return (
            <tr key={key}>
              <td style={{ paddingRight: '6px' }}>{display}</td>
              <td style={cellStyle}>{rad(rot.raw.x)}</td>
              <td style={{ ...cellStyle, color: highlightDelta(rot.raw.x, rot.applied.x) }}>{rad(rot.applied.x)}</td>
              <td style={cellStyle}>{rad(rot.raw.y)}</td>
              <td style={{ ...cellStyle, color: highlightDelta(rot.raw.y, rot.applied.y) }}>{rad(rot.applied.y)}</td>
              <td style={cellStyle}>{rad(rot.raw.z)}</td>
              <td style={{ ...cellStyle, color: highlightDelta(rot.raw.z, rot.applied.z) }}>{rad(rot.applied.z)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function highlightDelta(raw: number, applied: number): string {
  // The bridge flips the sign of X and Z for VRM 1.x, so a matching applied value
  // is +raw or -raw. Grey: under 5°. Yellow: under 15°. Red: 15° or more.
  const diff = Math.min(Math.abs(applied - raw), Math.abs(applied + raw))
  const deg = diff * 180 / Math.PI
  if (deg < 5) return '#9ca3af'
  if (deg < 15) return '#facc15'
  return '#f87171'
}

interface SceneSetup {
  rawCanvas: HTMLCanvasElement
  appliedCanvas: HTMLCanvasElement
  applyFrame: (
    raw: import('../lib/worker/protocol').RawLandmarks | undefined,
    applied: import('../lib/vrm/tracking-bridge').AppliedRotations | undefined,
    vrm: VRM | null,
  ) => void
  render: () => void
  dispose: () => void
}

interface Pane {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  skeleton: ReturnType<typeof createSkeletonRenderer>
}

/** One canvas per pane, so wheel and drag events reach only the pane under the cursor. */
function createPane(opts: {
  background: number
  skeletonColor: number
  showAxes: boolean
}): Pane {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(window.devicePixelRatio)
  // updateStyle=true sets the CSS size. Without it, the canvas takes the size of its
  // drawing buffer, which overflows the pane on HiDPI displays.
  renderer.setSize(PANE_WIDTH, PANE_HEIGHT, true)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(opts.background)
  scene.add(makeReferenceGrid())

  const camera = new THREE.PerspectiveCamera(35, PANE_WIDTH / PANE_HEIGHT, 0.01, 100)
  camera.position.set(0, 0.2, 3)
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = true
  controls.screenSpacePanning = true
  controls.zoomSpeed = 0.8
  controls.panSpeed = 0.8

  const skeleton = createSkeletonRenderer({
    color: opts.skeletonColor,
    showAxes: opts.showAxes,
    axesSize: 0.2,
  })
  skeleton.group.scale.setScalar(SKELETON_SCALE)
  scene.add(skeleton.group)

  return { renderer, scene, camera, controls, skeleton }
}

function createSceneSetup(): SceneSetup {
  const rawPane = createPane({
    background: 0x0a0a14,
    skeletonColor: 0x4ade80,
    showAxes: false,
  })
  const appliedPane = createPane({
    background: 0x14140a,
    skeletonColor: 0xf59e0b,
    showAxes: true,
  })

  function applyFrame(
    raw: import('../lib/worker/protocol').RawLandmarks | undefined,
    applied: import('../lib/vrm/tracking-bridge').AppliedRotations | undefined,
    vrm: VRM | null,
  ) {
    rawPane.skeleton.update(raw ? buildRawSkeleton(raw) : null)
    appliedPane.skeleton.update(buildAppliedSkeleton(vrm, applied ?? {}))
  }

  function render() {
    rawPane.controls.update()
    appliedPane.controls.update()
    rawPane.renderer.render(rawPane.scene, rawPane.camera)
    appliedPane.renderer.render(appliedPane.scene, appliedPane.camera)
  }

  function dispose() {
    rawPane.controls.dispose()
    appliedPane.controls.dispose()
    rawPane.skeleton.dispose()
    appliedPane.skeleton.dispose()
    rawPane.renderer.dispose()
    appliedPane.renderer.dispose()
    // dispose() keeps the WebGL context until garbage collection. At its context
    // limit, Chrome drops the oldest context, which is usually the avatar's.
    rawPane.renderer.forceContextLoss()
    appliedPane.renderer.forceContextLoss()
  }

  return {
    rawCanvas: rawPane.renderer.domElement,
    appliedCanvas: appliedPane.renderer.domElement,
    applyFrame,
    render,
    dispose,
  }
}

function makeReferenceGrid(): THREE.Group {
  const group = new THREE.Group()
  // A ground grid makes depth visible while the figure rotates.
  const grid = new THREE.GridHelper(2, 4, 0x333344, 0x222233)
  grid.position.y = -1.2
  group.add(grid)
  return group
}
