'use client'

/**
 * AvatarScene - Three.js canvas for VRM avatar rendering.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'

interface AvatarSceneProps {
  vrm?: VRM | null
  backgroundColor?: string
}

export function AvatarScene({ vrm, backgroundColor = '#1a1a2e' }: AvatarSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(backgroundColor)
    sceneRef.current = scene

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20
    )
    camera.position.set(0, 1.3, 1.5)
    cameraRef.current = camera

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // Animation loop
    let animationId: number
    function animate() {
      animationId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
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
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [backgroundColor])

  // Add/remove VRM from scene
  useEffect(() => {
    if (!sceneRef.current) return

    if (vrm?.scene) {
      sceneRef.current.add(vrm.scene)
    }

    return () => {
      if (vrm?.scene && sceneRef.current) {
        sceneRef.current.remove(vrm.scene)
      }
    }
  }, [vrm])

  return (
    <div
      ref={containerRef}
      data-testid="avatar-scene"
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    />
  )
}
