/**
 * Builders that transform raw MediaPipe landmarks and a live VRM into the
 * canonical Skeleton shape consumed by the stick-figure debug overlay.
 */

import type { VRM } from '@pixiv/three-vrm'
import * as THREE from 'three'
import type { RawLandmarks, RawLandmark } from '../worker/protocol'
import type { AppliedRotations } from '../vrm/tracking-bridge'
import {
  AXIS_JOINTS,
  HAND_INDICES,
  POSE_INDICES,
  type Skeleton,
  type SkeletonPoint,
  type Vec3,
} from './skeleton-model'

// Drawing visibility threshold is intentionally loose — the raw stick figure
// is for debugging tracking, so showing even noisy/partial detections is more
// useful than hiding them. The bridge has its own stricter 0.5 threshold for
// driving the VRM, which we explicitly don't reuse here.
const VISIBILITY_THRESHOLD = 0.1

interface Frame {
  origin: Vec3
  scale: number
}

/**
 * Pick the origin (mid-shoulder) and scale (shoulder-width) used to normalize
 * a raw landmark set into the canonical shoulder-frame. Returns null when the
 * shoulders aren't both visible, in which case the skeleton can't be built.
 *
 * MediaPipe's image-space y grows downward, so we flip it on output. The x is
 * mirrored too (selfie view); we leave that alone here — the raw pane just
 * reflects what the model sees.
 */
function shoulderFrameFromPose(pose: RawLandmark[]): Frame | null {
  const ls = pose[POSE_INDICES.leftShoulder]
  const rs = pose[POSE_INDICES.rightShoulder]
  if (!ls || !rs) return null
  if ((ls.visibility ?? 1) < VISIBILITY_THRESHOLD) return null
  if ((rs.visibility ?? 1) < VISIBILITY_THRESHOLD) return null

  const dx = rs.x - ls.x
  const dy = rs.y - ls.y
  const dz = rs.z - ls.z
  const shoulderWidth = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (shoulderWidth < 0.001) return null

  return {
    origin: {
      x: (ls.x + rs.x) / 2,
      y: (ls.y + rs.y) / 2,
      z: (ls.z + rs.z) / 2,
    },
    scale: shoulderWidth,
  }
}

function normalizeLandmark(p: RawLandmark, frame: Frame): Vec3 {
  return {
    // Mirror un-flip so the figure faces the viewer like the avatar does.
    x: -((p.x - frame.origin.x) / frame.scale),
    // Flip Y: MediaPipe Y grows downward.
    y: -((p.y - frame.origin.y) / frame.scale),
    z: (p.z - frame.origin.z) / frame.scale,
  }
}

function isVisible(p: RawLandmark | undefined): boolean {
  if (!p) return false
  return (p.visibility ?? 1) >= VISIBILITY_THRESHOLD
}

function addPosePoints(
  out: Record<string, SkeletonPoint>,
  pose: RawLandmark[],
  frame: Frame,
): void {
  for (const [name, idx] of Object.entries(POSE_INDICES) as Array<[keyof typeof POSE_INDICES, number]>) {
    const lm = pose[idx]
    if (!lm) continue
    out[name] = {
      position: normalizeLandmark(lm, frame),
      visible: isVisible(lm),
    }
  }
}

function addHandPoints(
  out: Record<string, SkeletonPoint>,
  hand: RawLandmark[],
  frame: Frame,
  side: 'left' | 'right',
): void {
  const wristPoint = out[side === 'left' ? 'leftWrist' : 'rightWrist']
  if (!wristPoint || !hand[HAND_INDICES.wrist]) return

  // MediaPipe hand landmarks are in image space too, but their scale is wrist-relative
  // and noisier. Anchor hand origin to the pose wrist; scale by the wrist→middleMCP
  // distance so finger lengths are comparable across hand sizes.
  const handWrist = hand[HAND_INDICES.wrist]
  const middleMCP = hand[HAND_INDICES.middleMCP]
  if (!middleMCP) return

  const dx = middleMCP.x - handWrist.x
  const dy = middleMCP.y - handWrist.y
  const dz = middleMCP.z - handWrist.z
  const palmSize = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (palmSize < 0.001) return

  // Target palm size in canonical (shoulder-frame) units — keeps hands visible at sane scale.
  const targetPalmSize = 0.25

  for (const [partName, idx] of Object.entries(HAND_INDICES) as Array<[keyof typeof HAND_INDICES, number]>) {
    const lm = hand[idx]
    if (!lm) continue
    if (partName === 'wrist') continue // already covered by pose

    const localX = (lm.x - handWrist.x) / palmSize * targetPalmSize
    const localY = (lm.y - handWrist.y) / palmSize * targetPalmSize
    const localZ = (lm.z - handWrist.z) / palmSize * targetPalmSize

    const fullName = `${side}${partName.charAt(0).toUpperCase()}${partName.slice(1)}`
    out[fullName] = {
      position: {
        x: wristPoint.position.x - localX,
        y: wristPoint.position.y - localY,
        z: wristPoint.position.z + localZ,
      },
      visible: true,
    }
  }
}

/**
 * Build a Skeleton from raw MediaPipe landmarks (pose + optional hands).
 * Returns null if the pose isn't reliable enough to anchor a frame on.
 */
export function buildRawSkeleton(raw: RawLandmarks): Skeleton | null {
  if (!raw.pose || raw.pose.length === 0) return null
  const frame = shoulderFrameFromPose(raw.pose)
  if (!frame) return null

  const points: Record<string, SkeletonPoint> = {}
  addPosePoints(points, raw.pose, frame)

  if (raw.leftHand && raw.leftHand.length > 0) {
    addHandPoints(points, raw.leftHand, frame, 'left')
  }
  if (raw.rightHand && raw.rightHand.length > 0) {
    addHandPoints(points, raw.rightHand, frame, 'right')
  }

  return { points, axes: [] }
}

const _tmpVec = new THREE.Vector3()

function sampleBonePosition(vrm: VRM, boneName: string, frame: Frame): Vec3 | null {
  // Cast through `never` to dodge VRM's strict humanoid-bone-name union type —
  // we accept any string here so this builder stays generic.
  const bone = vrm.humanoid.getNormalizedBoneNode(boneName as never)
  if (!bone) return null
  bone.getWorldPosition(_tmpVec)
  return {
    x: (_tmpVec.x - frame.origin.x) / frame.scale,
    y: (_tmpVec.y - frame.origin.y) / frame.scale,
    z: (_tmpVec.z - frame.origin.z) / frame.scale,
  }
}

/** Origin / scale for the VRM side: extracted from the live skeleton itself. */
function shoulderFrameFromVRM(vrm: VRM): Frame | null {
  const ls = vrm.humanoid.getNormalizedBoneNode('leftShoulder') ??
             vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
  const rs = vrm.humanoid.getNormalizedBoneNode('rightShoulder') ??
             vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
  if (!ls || !rs) return null

  const lPos = ls.getWorldPosition(new THREE.Vector3())
  const rPos = rs.getWorldPosition(new THREE.Vector3())
  const width = lPos.distanceTo(rPos)
  if (width < 0.001) return null

  return {
    origin: { x: (lPos.x + rPos.x) / 2, y: (lPos.y + rPos.y) / 2, z: (lPos.z + rPos.z) / 2 },
    scale: width,
  }
}

/**
 * VRM bone names corresponding to each skeleton joint. Some joints (e.g. left
 * shoulder for VRMs that don't expose a clavicle) fall back to the upper-arm.
 */
const VRM_BONE_FOR_POINT: Record<string, string[]> = {
  leftShoulder: ['leftUpperArm'],
  rightShoulder: ['rightUpperArm'],
  leftElbow: ['leftLowerArm'],
  rightElbow: ['rightLowerArm'],
  leftWrist: ['leftHand'],
  rightWrist: ['rightHand'],
  leftHip: ['leftUpperLeg'],
  rightHip: ['rightUpperLeg'],
  nose: ['head'],
}

const VRM_HAND_BONE_MAP: Record<string, string> = {
  ThumbCMC: 'ThumbMetacarpal',
  ThumbMCP: 'ThumbProximal',
  ThumbIP: 'ThumbDistal',
  ThumbTip: 'ThumbDistal', // No tip bone — use distal as approximation
  IndexMCP: 'IndexProximal',
  IndexPIP: 'IndexIntermediate',
  IndexDIP: 'IndexDistal',
  IndexTip: 'IndexDistal',
  MiddleMCP: 'MiddleProximal',
  MiddlePIP: 'MiddleIntermediate',
  MiddleDIP: 'MiddleDistal',
  MiddleTip: 'MiddleDistal',
  RingMCP: 'RingProximal',
  RingPIP: 'RingIntermediate',
  RingDIP: 'RingDistal',
  RingTip: 'RingDistal',
  PinkyMCP: 'LittleProximal',
  PinkyPIP: 'LittleIntermediate',
  PinkyDIP: 'LittleDistal',
  PinkyTip: 'LittleDistal',
}

/**
 * Sample the live VRM's bone world positions and the rotations the bridge applied
 * to them, returning a Skeleton in the same canonical shoulder-frame as the raw
 * side so the two can be compared directly.
 */
export function buildAppliedSkeleton(
  vrm: VRM | null,
  applied: AppliedRotations,
): Skeleton | null {
  if (!vrm) return null
  // Make sure the VRM's world matrices reflect the rotations applied this frame.
  vrm.scene.updateMatrixWorld(true)

  const frame = shoulderFrameFromVRM(vrm)
  if (!frame) return null

  const points: Record<string, SkeletonPoint> = {}

  for (const [pointName, candidates] of Object.entries(VRM_BONE_FOR_POINT)) {
    for (const boneName of candidates) {
      const pos = sampleBonePosition(vrm, boneName, frame)
      if (pos) {
        points[pointName] = { position: pos, visible: true }
        break
      }
    }
  }

  // Sample hand bones — names match the VRM 1.x humanoid hand-bone convention.
  for (const side of ['left', 'right'] as const) {
    const wristPoint = points[side === 'left' ? 'leftWrist' : 'rightWrist']
    if (!wristPoint) continue
    for (const [partName, vrmBaseName] of Object.entries(VRM_HAND_BONE_MAP)) {
      const fullVrmName = `${side}${vrmBaseName}`
      const pos = sampleBonePosition(vrm, fullVrmName, frame)
      if (pos) {
        const pointName = `${side}${partName}`
        points[pointName] = { position: pos, visible: true }
      }
    }
  }

  // Axis triads — one per bridge-tracked joint, using the applied rotation.
  const axes = AXIS_JOINTS.flatMap((joint) => {
    const boneNameForApplied = APPLIED_KEY_FOR_JOINT[joint] ?? joint
    const rot = applied[boneNameForApplied]
    if (!rot) return []
    if (!points[joint]) return []
    return [{
      point: joint,
      rotation: { x: rot.applied.x, y: rot.applied.y, z: rot.applied.z },
    }]
  })

  return { points, axes }
}

/**
 * Skeleton joint → AppliedRotations key. Shoulders/elbows in the bridge are
 * tracked under the VRM bone names (leftUpperArm, leftLowerArm, ...), not the
 * skeleton point names (leftShoulder, leftElbow).
 */
const APPLIED_KEY_FOR_JOINT: Record<string, string> = {
  leftShoulder: 'leftUpperArm',
  rightShoulder: 'rightUpperArm',
  leftElbow: 'leftLowerArm',
  rightElbow: 'rightLowerArm',
  spine: 'spine',
  head: 'head',
}
