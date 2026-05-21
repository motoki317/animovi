import { describe, it, expect } from 'vitest'
import { buildRawSkeleton } from './skeleton-builder'
import { POSE_INDICES } from './skeleton-model'
import type { RawLandmark } from '../worker/protocol'

function emptyPose(): RawLandmark[] {
  return new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }))
}

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
    // Mid-shoulder at (0.5, 0.4), shoulder width = 0.2 in image space
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.4, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.4, z: 0, visibility: 1 }
    pose[POSE_INDICES.leftWrist] = { x: 0.2, y: 0.4, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightWrist] = { x: 0.8, y: 0.4, z: 0, visibility: 1 }

    const skel = buildRawSkeleton({ pose })
    expect(skel).not.toBeNull()
    if (!skel) return

    // After normalization, shoulders should be ±0.5 on x.
    // x is mirror-flipped: leftShoulder.x = -(-0.5) = 0.5 (right side of mirror image)
    expect(skel.points.leftShoulder.position.x).toBeCloseTo(0.5, 3)
    expect(skel.points.rightShoulder.position.x).toBeCloseTo(-0.5, 3)
    expect(skel.points.leftShoulder.position.y).toBeCloseTo(0, 3)
    expect(skel.points.rightShoulder.position.y).toBeCloseTo(0, 3)

    // Wrists at the same horizontal level (T-pose), 1.0 shoulder-widths out from each shoulder.
    expect(skel.points.leftWrist.position.x).toBeCloseTo(1.5, 3)
    expect(skel.points.rightWrist.position.x).toBeCloseTo(-1.5, 3)
  })

  it('flips Y so up is up (raise arm → wrist above shoulder)', () => {
    const pose = emptyPose()
    pose[POSE_INDICES.leftShoulder] = { x: 0.4, y: 0.5, z: 0, visibility: 1 }
    pose[POSE_INDICES.rightShoulder] = { x: 0.6, y: 0.5, z: 0, visibility: 1 }
    // Wrist raised: in MediaPipe Y-down coords, raised = lower y value
    pose[POSE_INDICES.leftWrist] = { x: 0.4, y: 0.1, z: 0, visibility: 1 }

    const skel = buildRawSkeleton({ pose })
    expect(skel).not.toBeNull()
    if (!skel) return

    // After Y-flip, the wrist should be ABOVE the shoulder in canonical coords (higher y).
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
    // Index tip should now exist
    expect(skel.points.leftIndexTip).toBeDefined()
    expect(skel.points.leftThumbTip).toBeDefined()
  })
})
