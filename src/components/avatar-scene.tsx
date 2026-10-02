'use client'

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRMUtils } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'
import type { BackgroundType } from './background-settings'
import { renderProfiler } from '../lib/perf/profiler-instances'
import type { RendererInfo } from './performance-overlay'
import { captureThumbnail } from '../lib/vrm/vrm-thumbnail'

export interface AvatarSceneHandle {
  /** Draws a frame and encodes it as a JPEG thumbnail. */
  captureThumbnail: () => Promise<Blob>
}

interface AvatarSceneProps {
  vrm?: VRM | null
  backgroundType?: BackgroundType
  backgroundColor?: string
  /** Shown behind the canvas when backgroundType is 'image'. Without it, the solid color shows. */
  backgroundImageUrl?: string
  cameraY?: number
  cameraZ?: number
  autoFrameOnLoad?: boolean
  onAutoFrame?: (y: number, z: number) => void
  drawingFps?: number
  onRendererInfo?: (info: RendererInfo) => void
  ref?: Ref<AvatarSceneHandle>
}

/** Puts the camera at height `y` and distance `z`, looking level at the avatar's axis. */
function aimCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls | null, y: number, z: number) {
  camera.position.y = y
  camera.position.z = z
  camera.lookAt(0, y, 0)
  // OrbitControls.update() turns the camera toward the target on every frame.
  controls?.target.set(0, y, 0)
}

export function AvatarScene({
  vrm,
  backgroundType = 'solid',
  backgroundColor = '#1a1a2e',
  backgroundImageUrl,
  cameraY = 1.3,
  cameraZ = 1.5,
  autoFrameOnLoad = true,
  onAutoFrame,
  drawingFps = 60,
  onRendererInfo,
  ref,
}: AvatarSceneProps) {
  const [contextLost, setContextLost] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  // The render loop starts once on mount, so it reads changing props through refs.
  const vrmRef = useRef<VRM | null>(null)
  vrmRef.current = vrm ?? null
  const onAutoFrameRef = useRef(onAutoFrame)
  onAutoFrameRef.current = onAutoFrame
  const drawingFpsRef = useRef(drawingFps)
  drawingFpsRef.current = drawingFps
  const onRendererInfoRef = useRef(onRendererInfo)
  onRendererInfoRef.current = onRendererInfo

  // Frame each VRM once, even when the VRM effect runs again for the same VRM.
  const autoFramedVrmRef = useRef<VRM | null>(null)

  // Mount-time values. The effects below apply later changes.
  const initialCameraYRef = useRef(cameraY)
  const initialCameraZRef = useRef(cameraZ)

  useEffect(() => {
    if (!containerRef.current) return

    // The background effect below sets the initial background.
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20
    )
    camera.position.set(0, initialCameraYRef.current, initialCameraZRef.current)
    camera.lookAt(0, initialCameraYRef.current, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      // Alpha is fixed when the context is created. Enable it now so that the
      // background can switch to transparent or to an image later.
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    // Cap at 2x to limit the fill rate on high-DPI displays.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const canvas = renderer.domElement
    const handleContextLost = (event: Event) => {
      // Without preventDefault(), the browser never restores the context.
      event.preventDefault()
      setContextLost(true)
      console.warn('[AvatarScene] WebGL context lost')
    }
    const handleContextRestored = () => {
      setContextLost(false)
      console.info('[AvatarScene] WebGL context restored')
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, initialCameraYRef.current, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 0.5
    controls.maxDistance = 5
    controls.maxPolarAngle = Math.PI * 0.9
    controls.minPolarAngle = Math.PI * 0.1
    controlsRef.current = controls

    const timer = new THREE.Timer()
    let animationId: number
    let lastFrameTime = 0
    let rendererInfoCounter = 0
    function animate(timestamp = 0) {
      animationId = requestAnimationFrame(animate)

      const frameInterval = 1000 / drawingFpsRef.current
      const elapsed = timestamp - lastFrameTime
      if (elapsed < frameInterval) {
        return
      }
      // Carry the remainder forward. Setting lastFrameTime = timestamp drops the
      // average rate below the target.
      lastFrameTime = timestamp - (elapsed % frameInterval)

      renderProfiler.markFrame()

      timer.update(timestamp)
      const deltaTime = timer.getDelta()

      renderProfiler.begin('controls')
      // Damping needs an update on every frame.
      controls.update()
      renderProfiler.end('controls')

      renderProfiler.begin('vrm_update')
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime)
      }
      renderProfiler.end('vrm_update')

      renderProfiler.begin('render')
      renderer.render(scene, camera)
      renderProfiler.end('render')

      if (++rendererInfoCounter >= 60) {
        rendererInfoCounter = 0
        onRendererInfoRef.current?.({
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
        })
      }
    }
    animate()

    function handleResize() {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      controls.dispose()
      renderer.dispose()
      // dispose() keeps the WebGL context until garbage collection, and Chrome
      // drops the oldest context when too many are alive.
      renderer.forceContextLoss()
      // React clears containerRef before this cleanup runs, so remove the canvas
      // through its own reference.
      canvas.remove()
    }
  }, [])

  useEffect(() => {
    if (cameraRef.current) {
      aimCamera(cameraRef.current, controlsRef.current, cameraY, cameraZ)
    }
  }, [cameraY, cameraZ])

  // An image background is CSS on the container, so the canvas must stay transparent.
  const backgroundImage = backgroundType === 'image' && backgroundImageUrl ? backgroundImageUrl : undefined
  const canvasTransparent = backgroundType === 'transparent' || backgroundImage !== undefined

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = canvasTransparent ? null : new THREE.Color(backgroundColor)
    }
    rendererRef.current?.setClearColor(0x000000, canvasTransparent ? 0 : 1)
  }, [canvasTransparent, backgroundColor])

  useImperativeHandle(ref, () => ({
    captureThumbnail: () => {
      const renderer = rendererRef.current
      const scene = sceneRef.current
      const camera = cameraRef.current
      if (!renderer || !scene || !camera) {
        return Promise.reject(new Error('The avatar scene is not mounted'))
      }
      // The drawing buffer is not preserved, so it is black once the browser composites
      // the frame. Draw and read it in the same task.
      renderer.render(scene, camera)
      return captureThumbnail(renderer.domElement)
    },
  }), [])

  useEffect(() => {
    if (!sceneRef.current) return

    if (vrm?.scene) {
      // VRM 0.x models face -Z and VRM 1.x models face +Z. The camera is on +Z, so
      // rotateVRM0 turns VRM 0.x models 180° to face it.
      VRMUtils.rotateVRM0(vrm)
      sceneRef.current.add(vrm.scene)

      if (autoFrameOnLoad && vrm !== autoFramedVrmRef.current) {
        autoFramedVrmRef.current = vrm
        const camera = cameraRef.current
        if (camera) {
          try {
            let newY: number
            let newZ: number
            const headBone = vrm.humanoid?.getNormalizedBoneNode('head')
            if (headBone) {
              newY = headBone.getWorldPosition(new THREE.Vector3()).y
              newZ = 1.5
            } else {
              // Without a head bone, aim at the upper body of the bounding box.
              const box = new THREE.Box3().setFromObject(vrm.scene)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              newY = center.y + size.y * 0.2
              newZ = Math.max(1.5, size.y * 0.8)
            }
            aimCamera(camera, controlsRef.current, newY, newZ)
            onAutoFrameRef.current?.(newY, newZ)
          } catch {
            // Keep the current camera position if the model cannot be measured.
          }
        }
      }
    }

    return () => {
      if (vrm?.scene && sceneRef.current) {
        sceneRef.current.remove(vrm.scene)
      }
    }
  }, [vrm, autoFrameOnLoad])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
      <div
        ref={containerRef}
        data-testid="avatar-scene"
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {contextLost && (
        <div
          data-testid="context-lost-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            fontFamily: 'sans-serif',
            zIndex: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>WebGL context lost</p>
            <p style={{ color: '#aaa', fontSize: '0.875rem' }}>Waiting for GPU to recover...</p>
          </div>
        </div>
      )}
    </div>
  )
}
