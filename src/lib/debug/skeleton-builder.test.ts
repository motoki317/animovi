import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { buildAppliedSkeleton, buildRawSkeleton } from './skeleton-builder'
import { POSE_INDICES } from './skeleton-model'
import type { RawLandmark } from '../worker/protocol'

function emptyPose(): RawLandmark[] {
  return new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }))
}

function mockVRM(bonePositions: Record<string, [number, number, number]>): VRM {
  const scene = new THREE.Group()
  const bones: Record<string, THREE.Object3D> = {}
  for (const [name, [x, y, z]] of Object.entries(bonePositions)) {
    const bone = new THREE.Object3D()
    bone.position.set(x, y, z)
    scene.add(bone)
    bones[name] = bone
  }
  return {
    scene,
    humanoid: { getNormalizedBoneNode: (name: string) => bones[name] ?? null },
  } as unknown as VRM
}

const NO_ROTATION = { applied: { x: 0, y: 0, z: 0 }, raw: { x: 0, y: 0, z: 0 } }

describe('buildAppliedSkeleton', () => {
  it('scales by upper-arm width even when the VRM has clavicle bones', () => {
    const vrm = mockVRM({
      leftShoulder: [0.03, 1.4, 0],
      rightShoulder: [-0.03, 1.4, 0],
      leftUpperArm: [0.15, 1.4, 0],
      rightUpperArm: [-0.15, 1.4, 0],
    })

    const skel = buildAppliedSkeleton(vrm, {})
    expect(skel).not.toBeNull()

    const l = skel!.points.leftShoulder.position
    const r = skel!.points.rightShoulder.position
    expect(Math.hypot(l.x - r.x, l.y - r.y, l.z - r.z)).toBeCloseTo(1, 5)
  })

  it('emits axis triads for every AXIS_JOINTS joint that the bridge rotated', () => {
    const vrm = mockVRM({
      leftUpperArm: [0.15, 1.4, 0],
      rightUpperArm: [-0.15, 1.4, 0],
      leftLowerArm: [0.4, 1.4, 0],
      rightLowerArm: [-0.4, 1.4, 0],
      spine: [0, 1.1, 0],
      head: [0, 1.6, 0],
    })

    const skel = buildAppliedSkeleton(vrm, {
      spine: NO_ROTATION,
      head: NO_ROTATION,
      leftUpperArm: NO_ROTATION,
      rightUpperArm: NO_ROTATION,
      leftLowerArm: NO_ROTATION,
      rightLowerArm: NO_ROTATION,
    })
    expect(skel).not.toBeNull()

    expect(skel!.axes.map((a) => a.point).sort()).toEqual(
      ['head', 'leftElbow', 'leftShoulder', 'rightElbow', 'rightShoulder', 'spine'],
    )
  })
})

describe('buildRawSkeleton', () => {
  it('returns null when no pose is given', () => {
    expect(buildRawSkeleton({})).toBeNull()
  })

  it('returns null when pose array is empty', () => {
    expect(buildRawSkeleton({ pose: [] })).toBeNull()
  })

  it('returns null when shoulders are not confidently visible', () => {
    const pose = emptyPose()
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.5, z: 0, visibility: 0.05 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.5, z: 0, visibility: 0.05 }
    expect(buildRawSkeleton({ pose })).toBeNull()
  })

  it('normalizes a T-pose body so shoulders sit at ±0.5 on x', () => {
    const pose = emptyPose()
    // Mid-shoulder at (0.5, 0.4), shoulder width 0.2 in image space.
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.4, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.4, z: 0, visibility: 1 }
    pose[POSE_INDICES.leftWrist] = { x: 0.2, y: 0.4, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightWrist] = { x: 0.8, y: 0.4, z: 0, visibility: 1 }

    const skel = buildRawSkeleton({ pose })
    expect(skel).not.toBeNull()
    if (!skel) return

    // normalizeLandmark negates x, so the left shoulder lands at +0.5.
    expect(skel.points.leftShoulder.position.x).toBeCloseTo(0.5, 3)
    expect(skel.points.rightShoulder.position.x).toBeCloseTo(-0.5, 3)
    expect(skel.points.leftShoulder.position.y).toBeCloseTo(0, 3)
    expect(skel.points.rightShoulder.position.y).toBeCloseTo(0, 3)

    // T-pose: each wrist is one shoulder width beyond its shoulder.
    expect(skel.points.leftWrist.position.x).toBeCloseTo(1.5, 3)
    expect(skel.points.rightWrist.position.x).toBeCloseTo(-1.5, 3)
  })

  it('flips Y so up is up (raise arm → wrist above shoulder)', () => {
    const pose = emptyPose()
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.5, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.5, z: 0, visibility: 1 }
    // MediaPipe y grows downward, so a raised wrist has a smaller y.
    pose[POSE_INDICES.leftWrist] = { x: 0.4, y: 0.1, z: 0, visibility: 1 }

    const skel = buildRawSkeleton({ pose })
    expect(skel).not.toBeNull()
    if (!skel) return

    expect(skel.points.leftWrist.position.y).toBeGreaterThan(skel.points.leftShoulder.position.y)
  })

  it('marks invisible landmarks as not visible', () => {
    const pose = emptyPose()
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.5, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.5, z: 0, visibility: 1 }
    pose[POSE_INDICES.leftWrist] = { x: 0.2, y: 0.5, z: 0, visibility: 0.05 }

    const skel = buildRawSkeleton({ pose })
    expect(skel).not.toBeNull()
    if (!skel) return
    expect(skel.points.leftWrist.visible).toBe(false)
    expect(skel.points.leftShoulder.visible).toBe(true)
  })

  it('includes hand landmarks when provided, anchored to the wrist', () => {
    const pose = emptyPose()
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.5, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.5, z: 0, visibility: 1 }
    pose[POSE_INDICES.leftWrist] = { x: 0.2, y: 0.5, z: 0, visibility: 1 }

    const leftHand: RawLandmark[] = new Array(21).fill(null).map((_, i) => ({
      x: 0.2,
      y: 0.5 + i * 0.01,
      z: 0,
    }))

    const skel = buildRawSkeleton({ pose, leftHand })
    expect(skel).not.toBeNull()
    if (!skel) return
    expect(skel.points.leftIndexTip).toBeDefined()
    expect(skel.points.leftThumbTip).toBeDefined()
  })
})
