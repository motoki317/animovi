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

// Lower than the 0.5 that pose-solver.ts uses to drive the VRM, so that the
// overlay also draws the noisy detections that the solver drops.
const VISIBILITY_THRESHOLD = 0.1

interface Frame {
  origin: Vec3
  scale: number
}

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
    // Same x flip as toSolverSpace() in pose-solver.ts.
    x: -((p.x - frame.origin.x) / frame.scale),
    // MediaPipe image y grows downward.
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

  // Anchor the hand at the pose wrist and draw every hand at the same palm
  // size (wrist to middle MCP), whatever its size in the image.
  const handWrist = hand[HAND_INDICES.wrist]
  const middleMCP = hand[HAND_INDICES.middleMCP]
  if (!middleMCP) return

  const dx = middleMCP.x - handWrist.x
  const dy = middleMCP.y - handWrist.y
  const dz = middleMCP.z - handWrist.z
  const palmSize = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (palmSize < 0.001) return

  // In shoulder widths.
  const targetPalmSize = 0.25

  for (const [partName, idx] of Object.entries(HAND_INDICES) as Array<[keyof typeof HAND_INDICES, number]>) {
    const lm = hand[idx]
    if (!lm) continue
    if (partName === 'wrist') continue // The pose supplies the wrist point.

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

/** Returns null when the pose has no usable pair of shoulders. */
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
  // The names come from string tables, so `as never` bypasses the
  // VRMHumanBoneName union. An unknown name returns null.
  const bone = vrm.humanoid.getNormalizedBoneNode(boneName as never)
  if (!bone) return null
  bone.getWorldPosition(_tmpVec)
  return {
    x: (_tmpVec.x - frame.origin.x) / frame.scale,
    y: (_tmpVec.y - frame.origin.y) / frame.scale,
    z: (_tmpVec.z - frame.origin.z) / frame.scale,
  }
}

// Uses the same bones as the leftShoulder and rightShoulder points, so the
// drawn shoulder width is 1 as on the raw side.
function shoulderFrameFromVRM(vrm: VRM): Frame | null {
  const ls = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
  const rs = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
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
 * Pose landmarks 11 and 12 mark the shoulder joints, where the upper-arm bones
 * start. The VRM `leftShoulder` and `rightShoulder` bones are the optional
 * clavicles. The spine and head points anchor the AXIS_JOINTS triads.
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
  spine: ['spine'],
  head: ['head'],
}

const VRM_HAND_BONE_MAP: Record<string, string> = {
  ThumbCMC: 'ThumbMetacarpal',
  ThumbMCP: 'ThumbProximal',
  ThumbIP: 'ThumbDistal',
  ThumbTip: 'ThumbDistal', // VRM has no fingertip bones.
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
 * Calls `vrm.scene.updateMatrixWorld(true)`. Returns null without a VRM or
 * without both upper-arm bones.
 */
export function buildAppliedSkeleton(
  vrm: VRM | null,
  applied: AppliedRotations,
): Skeleton | null {
  if (!vrm) return null
  // Rotations that the bridge set this frame reach matrixWorld only at the
  // next matrix update.
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

  // VRM 1.0 hand-bone names. three-vrm also exposes VRM 0.x models under them.
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

/** The bridge keys AppliedRotations by VRM bone name, not by skeleton point name. */
const APPLIED_KEY_FOR_JOINT: Record<string, string> = {
  leftShoulder: 'leftUpperArm',
  rightShoulder: 'rightUpperArm',
  leftElbow: 'leftLowerArm',
  rightElbow: 'rightLowerArm',
  spine: 'spine',
  head: 'head',
}
