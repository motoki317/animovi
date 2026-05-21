/**
 * Canonical skeleton data model used by the stick-figure debug overlay.
 *
 * Both the raw MediaPipe pipeline (image-space landmarks) and the live VRM
 * (Three.js bone world positions) get normalized into this shape so the two
 * panes of the overlay can be compared apples-to-apples — every body is
 * centered on its own mid-shoulder and scaled so shoulder-width equals 1.
 *
 * Why a shared model: the raw and applied skeletons originate in different
 * coordinate systems (MediaPipe is mirrored-image-space, VRM is metric Y-up
 * world). Without normalization, the user cannot tell whether a visible
 * discrepancy is a real rotation difference or just a scale/origin offset.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface SkeletonPoint {
  /** Position in the canonical shoulder-frame (mid-shoulder origin, shoulder-width = 1). */
  position: Vec3
  /** True if the underlying source had this landmark visible / confidently detected. */
  visible: boolean
}

export interface SkeletonAxes {
  /** The joint this axis triad is anchored to. */
  point: string
  /** Euler rotation in ZYX order, in the joint's local frame. */
  rotation: Vec3
}

export interface Skeleton {
  /** Joint positions keyed by canonical name (e.g. 'leftShoulder', 'rightWrist'). */
  points: Record<string, SkeletonPoint>
  /** Per-joint local-axis triads — only present on the "applied" side. */
  axes: SkeletonAxes[]
}

/**
 * Connections used by the stick-figure renderer. Both sides use the same list
 * so the two figures are visually comparable.
 */
export const BONE_CONNECTIONS: ReadonlyArray<readonly [string, string]> = [
  // Torso
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],

  // Arms
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],

  // Head (approximation — nose anchored to mid-shoulder via implicit chain)
  ['leftShoulder', 'nose'],
  ['rightShoulder', 'nose'],

  // Left hand — MediaPipe hand connection list (simplified to one chain per finger)
  ['leftWrist', 'leftThumbCMC'],
  ['leftThumbCMC', 'leftThumbMCP'],
  ['leftThumbMCP', 'leftThumbIP'],
  ['leftThumbIP', 'leftThumbTip'],
  ['leftWrist', 'leftIndexMCP'],
  ['leftIndexMCP', 'leftIndexPIP'],
  ['leftIndexPIP', 'leftIndexDIP'],
  ['leftIndexDIP', 'leftIndexTip'],
  ['leftWrist', 'leftMiddleMCP'],
  ['leftMiddleMCP', 'leftMiddlePIP'],
  ['leftMiddlePIP', 'leftMiddleDIP'],
  ['leftMiddleDIP', 'leftMiddleTip'],
  ['leftWrist', 'leftRingMCP'],
  ['leftRingMCP', 'leftRingPIP'],
  ['leftRingPIP', 'leftRingDIP'],
  ['leftRingDIP', 'leftRingTip'],
  ['leftWrist', 'leftPinkyMCP'],
  ['leftPinkyMCP', 'leftPinkyPIP'],
  ['leftPinkyPIP', 'leftPinkyDIP'],
  ['leftPinkyDIP', 'leftPinkyTip'],

  // Right hand — same chain pattern
  ['rightWrist', 'rightThumbCMC'],
  ['rightThumbCMC', 'rightThumbMCP'],
  ['rightThumbMCP', 'rightThumbIP'],
  ['rightThumbIP', 'rightThumbTip'],
  ['rightWrist', 'rightIndexMCP'],
  ['rightIndexMCP', 'rightIndexPIP'],
  ['rightIndexPIP', 'rightIndexDIP'],
  ['rightIndexDIP', 'rightIndexTip'],
  ['rightWrist', 'rightMiddleMCP'],
  ['rightMiddleMCP', 'rightMiddlePIP'],
  ['rightMiddlePIP', 'rightMiddleDIP'],
  ['rightMiddleDIP', 'rightMiddleTip'],
  ['rightWrist', 'rightRingMCP'],
  ['rightRingMCP', 'rightRingPIP'],
  ['rightRingPIP', 'rightRingDIP'],
  ['rightRingDIP', 'rightRingTip'],
  ['rightWrist', 'rightPinkyMCP'],
  ['rightPinkyMCP', 'rightPinkyPIP'],
  ['rightPinkyPIP', 'rightPinkyDIP'],
  ['rightPinkyDIP', 'rightPinkyTip'],
]

/** Joints that get axis-triad gizmos on the applied side (matches VRM-bridged bones). */
export const AXIS_JOINTS: readonly string[] = [
  'spine',
  'head',
  'leftShoulder',
  'leftElbow',
  'rightShoulder',
  'rightElbow',
]

/** MediaPipe Pose landmark indices for the body landmarks we care about. */
export const POSE_INDICES = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const

/** MediaPipe Hand landmark indices (21 per hand). */
export const HAND_INDICES = {
  wrist: 0,
  thumbCMC: 1,
  thumbMCP: 2,
  thumbIP: 3,
  thumbTip: 4,
  indexMCP: 5,
  indexPIP: 6,
  indexDIP: 7,
  indexTip: 8,
  middleMCP: 9,
  middlePIP: 10,
  middleDIP: 11,
  middleTip: 12,
  ringMCP: 13,
  ringPIP: 14,
  ringDIP: 15,
  ringTip: 16,
  pinkyMCP: 17,
  pinkyPIP: 18,
  pinkyDIP: 19,
  pinkyTip: 20,
} as const
