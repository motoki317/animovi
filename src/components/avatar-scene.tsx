'use client'

/**
 * AvatarScene - Three.js canvas for VRM avatar rendering.
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRMUtils } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'
import type { BackgroundType } from './background-settings'
import { renderProfiler } from '../lib/perf/profiler-instances'
import type { RendererInfo } from './performance-overlay'

interface AvatarSceneProps {
  vrm?: VRM | null
  backgroundType?: BackgroundType
  backgroundColor?: string
  cameraY?: number
  cameraZ?: number
  autoFrameOnLoad?: boolean
  onAutoFrame?: (y: number, z: number) => void
  enableOrbitControls?: boolean
  drawingFps?: number
  onRendererInfo?: (info: RendererInfo) => void
}

export function AvatarScene({
  vrm,
  backgroundType = 'solid',
  backgroundColor = '#1a1a2e',
  cameraY = 1.3,
  cameraZ = 1.5,
  autoFrameOnLoad = true,
  onAutoFrame,
  enableOrbitControls = true,
  drawingFps = 60,
  onRendererInfo,
}: AvatarSceneProps) {
  const [contextLost, setContextLost] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const clockRef = useRef<THREE.Clock | null>(null)

  // Store VRM in ref so animation loop can access it
  const vrmRef = useRef<VRM | null>(null)
  vrmRef.current = vrm ?? null

  // Store callback in ref to avoid dependency issues
  const onAutoFrameRef = useRef(onAutoFrame)
  onAutoFrameRef.current = onAutoFrame

  // Track which VRM we've already auto-framed to prevent loops
  const autoFramedVrmRef = useRef<VRM | null>(null)

  // Store drawing FPS in ref so render loop can access latest value
  const drawingFpsRef = useRef(drawingFps)
  drawingFpsRef.current = drawingFps

  // Store renderer info callback in ref
  const onRendererInfoRef = useRef(onRendererInfo)
  onRendererInfoRef.current = onRendererInfo

  // Store initial values in refs for initialization
  const initialBackgroundTypeRef = useRef(backgroundType)
  const initialBackgroundColorRef = useRef(backgroundColor)
  const initialCameraYRef = useRef(cameraY)
  const initialCameraZRef = useRef(cameraZ)
  const enableOrbitControlsRef = useRef(enableOrbitControls)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize scene
    const scene = new THREE.Scene()
    if (initialBackgroundTypeRef.current === 'transparent') {
      scene.background = null
    } else {
      scene.background = new THREE.Color(initialBackgroundColorRef.current)
    }
    sceneRef.current = scene

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20
    )
    camera.position.set(0, initialCameraYRef.current, initialCameraZRef.current)
    camera.lookAt(0, initialCameraYRef.current, 0)
    cameraRef.current = camera

    // Initialize renderer with alpha support for potential transparent backgrounds
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // Always enable alpha for flexibility
      powerPreference: 'high-performance',
    })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    // Cap pixel ratio at 2 to avoid excessive fill rate on high-DPI displays
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    if (initialBackgroundTypeRef.current === 'transparent') {
      renderer.setClearColor(0x000000, 0)
    }
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Handle WebGL context loss/restore
    const canvas = renderer.domElement
    const handleContextLost = (event: Event) => {
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

    // Add lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // Initialize orbit controls for camera manipulation
    let controls: OrbitControls | null = null
    if (enableOrbitControlsRef.current) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, initialCameraYRef.current, 0)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 0.5
      controls.maxDistance = 5
      controls.maxPolarAngle = Math.PI * 0.9 // Prevent flipping
      controls.minPolarAngle = Math.PI * 0.1
      controlsRef.current = controls
    }

    // Animation loop with VRM update and FPS limiting
    const clock = new THREE.Clock()
    clockRef.current = clock
    let animationId: number
    let lastFrameTime = 0
    let rendererInfoCounter = 0
    function animate(timestamp = 0) {
      animationId = requestAnimationFrame(animate)

      // Throttle to target drawing FPS
      const frameInterval = 1000 / drawingFpsRef.current
      const elapsed = timestamp - lastFrameTime
      if (elapsed < frameInterval) {
        return
      }
      // Carry forward remainder to prevent drift and frame skipping
      lastFrameTime = timestamp - (elapsed % frameInterval)

      renderProfiler.markFrame()

      const deltaTime = clock.getDelta()

      renderProfiler.begin('controls')
      controls?.update() // Required for damping
      renderProfiler.end('controls')

      // Update VRM (required for expressions, spring bones, and constraints)
      renderProfiler.begin('vrm_update')
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime)
      }
      renderProfiler.end('vrm_update')

      renderProfiler.begin('render')
      renderer.render(scene, camera)
      renderProfiler.end('render')

      // Emit renderer info periodically (every ~60 frames)
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

    // Handle resize
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
      controls?.dispose()
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, []) // Empty deps - only initialize once

  // Update camera position when props change
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.position.y = cameraY
      cameraRef.current.position.z = cameraZ
      cameraRef.current.lookAt(0, cameraY, 0)
    }
  }, [cameraY, cameraZ])

  // Update background when props change
  useEffect(() => {
    if (sceneRef.current) {
      if (backgroundType === 'transparent') {
        sceneRef.current.background = null
      } else {
        sceneRef.current.background = new THREE.Color(backgroundColor)
      }
    }
    if (rendererRef.current) {
      if (backgroundType === 'transparent') {
        rendererRef.current.setClearColor(0x000000, 0)
      } else {
        rendererRef.current.setClearColor(0x000000, 1)
      }
    }
  }, [backgroundType, backgroundColor])

  // Add/remove VRM from scene and handle auto-framing
  useEffect(() => {
    if (!sceneRef.current) return

    if (vrm?.scene) {
      // VRM 0.x models face +Z natively; VRM 1.x face -Z. The default Three.js camera
      // sits at +Z looking toward origin, so VRM 0.x must be flipped to match VRM 1.x.
      // rotateVRM0 is a no-op for VRM 1.x.
      VRMUtils.rotateVRM0(vrm)
      sceneRef.current.add(vrm.scene)

      // Auto-frame to head position when VRM loads (only once per VRM)
      if (autoFrameOnLoad && vrm !== autoFramedVrmRef.current) {
        autoFramedVrmRef.current = vrm

        // Run auto-frame logic
        if (cameraRef.current) {
          try {
            // Try to get head bone position
            const headBone = vrm.humanoid?.getNormalizedBoneNode('head')
            if (headBone) {
              const headPos = new THREE.Vector3()
              headBone.getWorldPosition(headPos)

              // Position camera to look at head with some offset
              const newY = headPos.y
              const newZ = 1.5 // Keep default distance

              cameraRef.current.position.y = newY
              cameraRef.current.position.z = newZ
              cameraRef.current.lookAt(0, newY, 0)

              // Notify parent via ref (avoids dependency loop)
              onAutoFrameRef.current?.(newY, newZ)
            } else {
              // Fallback: use bounding box center
              const box = new THREE.Box3().setFromObject(vrm.scene)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())

              // Position camera to see the upper body/head
              const newY = center.y + size.y * 0.2
              const newZ = Math.max(1.5, size.y * 0.8)

              cameraRef.current.position.y = newY
              cameraRef.current.position.z = newZ
              cameraRef.current.lookAt(0, newY, 0)

              // Notify parent via ref (avoids dependency loop)
              onAutoFrameRef.current?.(newY, newZ)
            }
          } catch {
            // Silently fail - keep current camera position
          }
        }
      }
    }

    return () => {
      if (vrm?.scene && sceneRef.current) {
        sceneRef.current.remove(vrm.scene)
      }
    }
  }, [vrm, autoFrameOnLoad]) // Removed autoFrameToHead dependency - using refs instead

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
      <div
        ref={containerRef}
        data-testid="avatar-scene"
        style={{ width: '100%', height: '100%' }}
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
