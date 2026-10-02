/**
 * Keeps one Group and one line buffer for its whole life and updates them in
 * place, so a tracking frame allocates no new geometry.
 */

import * as THREE from 'three'
import { AXIS_JOINTS, BONE_CONNECTIONS, type Skeleton } from './skeleton-model'

export interface SkeletonRendererOptions {
  /** Hex color for lines and joint dots. */
  color?: number
  /** Draws an axis triad on each AXIS_JOINTS point. */
  showAxes?: boolean
  /** In shoulder widths. */
  axesSize?: number
}

/** `group` is the same object for the renderer's whole life, so add it to a scene once. */
export interface SkeletonRenderer {
  group: THREE.Group
  update(skeleton: Skeleton | null): void
  dispose(): void
}

export function createSkeletonRenderer(options: SkeletonRendererOptions = {}): SkeletonRenderer {
  const color = options.color ?? 0x4ade80
  const showAxes = options.showAxes ?? false
  const axesSize = options.axesSize ?? 0.15

  const group = new THREE.Group()

  const lineGeometry = new THREE.BufferGeometry()
  const linePositions = new Float32Array(BONE_CONNECTIONS.length * 2 * 3)
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 })
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
  group.add(lines)

  const jointDots = new Map<string, THREE.Mesh>()
  const dotGeometry = new THREE.SphereGeometry(0.02, 6, 6)
  const dotMaterial = new THREE.MeshBasicMaterial({ color })

  function getOrCreateDot(name: string): THREE.Mesh {
    let dot = jointDots.get(name)
    if (!dot) {
      dot = new THREE.Mesh(dotGeometry, dotMaterial)
      group.add(dot)
      jointDots.set(name, dot)
    }
    return dot
  }

  const axisHelpers = new Map<string, { container: THREE.Group; helper: THREE.AxesHelper }>()
  if (showAxes) {
    for (const joint of AXIS_JOINTS) {
      const container = new THREE.Group()
      const helper = new THREE.AxesHelper(axesSize)
      container.add(helper)
      container.visible = false
      group.add(container)
      axisHelpers.set(joint, { container, helper })
    }
  }

  function update(skeleton: Skeleton | null): void {
    if (!skeleton) {
      lines.visible = false
      jointDots.forEach((d) => (d.visible = false))
      axisHelpers.forEach((a) => (a.container.visible = false))
      return
    }
    lines.visible = true

    let cursor = 0
    for (const [from, to] of BONE_CONNECTIONS) {
      const a = skeleton.points[from]
      const b = skeleton.points[to]
      if (a && b && a.visible && b.visible) {
        linePositions[cursor++] = a.position.x
        linePositions[cursor++] = a.position.y
        linePositions[cursor++] = a.position.z
        linePositions[cursor++] = b.position.x
        linePositions[cursor++] = b.position.y
        linePositions[cursor++] = b.position.z
      } else {
        // Collapse a hidden segment to the origin. This needs no per-segment
        // visibility state.
        for (let i = 0; i < 6; i++) linePositions[cursor++] = 0
      }
    }
    lineGeometry.attributes.position.needsUpdate = true
    lineGeometry.computeBoundingSphere()

    const seen = new Set<string>()
    for (const [name, point] of Object.entries(skeleton.points)) {
      seen.add(name)
      const dot = getOrCreateDot(name)
      dot.position.set(point.position.x, point.position.y, point.position.z)
      dot.visible = point.visible
    }
    jointDots.forEach((d, name) => {
      if (!seen.has(name)) d.visible = false
    })

    if (showAxes) {
      const axesByJoint = new Map(skeleton.axes.map((a) => [a.point, a]))
      axisHelpers.forEach((entry, joint) => {
        const axisData = axesByJoint.get(joint)
        const point = skeleton.points[joint]
        if (axisData && point && point.visible) {
          entry.container.position.set(point.position.x, point.position.y, point.position.z)
          entry.container.rotation.set(
            axisData.rotation.x,
            axisData.rotation.y,
            axisData.rotation.z,
            'ZYX',
          )
          entry.container.visible = true
        } else {
          entry.container.visible = false
        }
      })
    }
  }

  function dispose(): void {
    lineGeometry.dispose()
    lineMaterial.dispose()
    dotGeometry.dispose()
    dotMaterial.dispose()
    axisHelpers.forEach((entry) => {
      entry.helper.dispose()
    })
    axisHelpers.clear()
    jointDots.clear()
  }

  return { group, update, dispose }
}
