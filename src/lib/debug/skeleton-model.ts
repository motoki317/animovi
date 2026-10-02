/**
 * Shared shape for the two panes of the stick-figure debug overlay. The raw
 * pane comes from MediaPipe image-space landmarks, and the applied pane from
 * VRM bone world positions in meters. Both builders center each body on its
 * mid-shoulder and scale it to a shoulder width of 1. Without this step, a
 * scale or origin offset between the panes looks like a rotation error.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface SkeletonPoint {
  /** Mid-shoulder origin, in shoulder widths. */
  position: Vec3
  /** False when the MediaPipe visibility is below the threshold in skeleton-builder.ts. */
  visible: boolean
}

export interface SkeletonAxes {
  /** Key into Skeleton.points. */
  point: string
  /** Radians, ZYX order, in the bone's local frame. */
  rotation: Vec3
}

export interface Skeleton {
  points: Record<string, SkeletonPoint>
  /** Empty on the raw side. */
  axes: SkeletonAxes[]
}

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

  // Head: there is no neck point, so the nose connects to both shoulders.
  ['leftShoulder', 'nose'],
  ['rightShoulder', 'nose'],

  // Left hand: one chain per finger, from the wrist.
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

  // Right hand
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

/** Points whose bones the bridge rotates. The applied pane draws an axis triad on each. */
export const AXIS_JOINTS: readonly string[] = [
  'spine',
  'head',
  'leftShoulder',
  'leftElbow',
  'rightShoulder',
  'rightElbow',
]

/** MediaPipe Pose landmark indices. */
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
