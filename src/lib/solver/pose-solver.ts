/**
 * Pose Solver - Extracts body rotations from pose landmarks.
 *
 * Uses direct vector-to-euler computation (KalidoKit-style) for arm rotations.
 * This approach directly uses the detected landmark positions rather than
 * solving inverse kinematics, which is simpler and more predictable.
 */

import { solveArmDirect, clampArmRotation, type Vector3 } from '../math/two-bone-ik'

export interface PoseLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export type PoseLandmarks = PoseLandmark[]

export interface ArmResult {
  shoulder: { x: number; y: number; z: number }
  elbow: { x: number; y: number; z: number }
}

export interface PoseResult {
  spine: {
    pitch: number
    yaw: number
    roll: number
  }
  leftArm: ArmResult | null
  rightArm: ArmResult | null
}

// MediaPipe Pose landmark indices
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_ELBOW = 13
const RIGHT_ELBOW = 14
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24
const VISIBILITY_THRESHOLD = 0.5

// Spine-yaw tuning, calibrated against real footage (.local/test.mp4).
// GAIN attenuates the detected shoulder-line turn so the torso tracks genuine
// body rotation only subtly — matching kalidoface, whose spine dampener is ~0.45.
// It is a deliberate tradeoff: the shoulder landmarks shift with head turns and
// raised hands, and no shoulder-only formula can separate that from a real torso
// turn, so GAIN scales wanted and unwanted response by the same factor. Measured
// effect vs the old `(Δz_norm)*3`: head→body coupling 4.06 → 0.58 °/°, resting
// jitter 12.6° → 1.9° sd, while a genuine turn still registers at half strength.
export const SPINE_YAW_GAIN = 0.5
// Safety rail near the atan2 wrap that occurs at ~90° (profile) turns; well
// outside a seated VTuber's range.
export const SPINE_YAW_CLAMP = Math.PI / 4

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Transform MediaPipe coordinates to VRM bone-local space.
 *
 * MediaPipe (mirrored webcam): X 0-1 left-to-right, Y 0-1 top-to-bottom, Z negative toward camera
 * VRM bone space: Y-up, model faces +Z. Scene is rotated PI around Y to face camera.
 *
 * Key insight: The scene rotation (vrm.scene.rotation.y = Math.PI) flips both X and Z
 * in world space. We must NOT double-flip Z here — the scene rotation handles it.
 * X needs un-mirroring which cancels with the scene flip, so we still flip X here.
 */
function toVRMSpace(p: PoseLandmark): Vector3 {
  return {
    x: -(p.x - 0.5), // Flip X around center to un-mirror
    y: -p.y, // Flip Y (MediaPipe Y-down to VRM Y-up)
    z: p.z, // Keep Z sign: scene rotation (PI around Y) handles the coordinate flip
  }
}

/**
 * Solve arm rotations using direct vector-to-euler (KalidoKit-style).
 *
 * Uses the actual landmark positions to compute rotations directly,
 * which is simpler and more predictable than IK.
 */
function solveArm(
  shoulder: PoseLandmark,
  elbow: PoseLandmark,
  wrist: PoseLandmark,
  isLeft: boolean
): ArmResult | null {
  // Check if key arm landmarks are visible
  if (
    (elbow.visibility ?? 0) < VISIBILITY_THRESHOLD ||
    (wrist.visibility ?? 0) < VISIBILITY_THRESHOLD
  ) {
    return null
  }

  const shoulderVRM = toVRMSpace(shoulder)
  const elbowVRM = toVRMSpace(elbow)
  const wristVRM = toVRMSpace(wrist)

  const result = clampArmRotation(solveArmDirect({
    shoulder: shoulderVRM,
    elbow: elbowVRM,
    wrist: wristVRM,
    isLeft,
  }))

  return {
    shoulder: result.shoulder,
    elbow: result.elbow,
  }
}

export function solvePose(
  landmarks: PoseLandmarks,
  // Metric 3D pose landmarks (MediaPipe poseWorldLandmarks). Used for spine yaw,
  // whose normalized-z source was unreliable; arms/roll keep using `landmarks`.
  worldLandmarks?: PoseLandmarks,
): PoseResult | null {
  if (landmarks.length === 0) {
    return null
  }

  const leftShoulder = landmarks[LEFT_SHOULDER]
  const rightShoulder = landmarks[RIGHT_SHOULDER]
  const leftElbow = landmarks[LEFT_ELBOW]
  const rightElbow = landmarks[RIGHT_ELBOW]
  const leftWrist = landmarks[LEFT_WRIST]
  const rightWrist = landmarks[RIGHT_WRIST]
  const leftHip = landmarks[LEFT_HIP]
  const rightHip = landmarks[RIGHT_HIP]

  // Check visibility of key landmarks
  if (
    (leftShoulder.visibility ?? 0) < VISIBILITY_THRESHOLD ||
    (rightShoulder.visibility ?? 0) < VISIBILITY_THRESHOLD
  ) {
    return null
  }

  // Spine yaw (left/right body turn) from the shoulder-line angle.
  // Right shoulder forward = positive yaw (body turned right).
  // atan2(Δz, -Δx) measures the shoulder line's rotation away from its rest
  // direction (world -X), so forward reads ~0 and stays off the atan2 ±180°
  // branch cut. Scale-invariant in shoulder width, then attenuated + clamped.
  const lShoulderW = worldLandmarks?.[LEFT_SHOULDER]
  const rShoulderW = worldLandmarks?.[RIGHT_SHOULDER]
  let spineYaw: number
  if (lShoulderW && rShoulderW) {
    const dz = rShoulderW.z - lShoulderW.z
    const dx = rShoulderW.x - lShoulderW.x
    spineYaw = clamp(Math.atan2(dz, -dx) * SPINE_YAW_GAIN, -SPINE_YAW_CLAMP, SPINE_YAW_CLAMP)
  } else {
    // No metric landmarks (face-only paths / unit fixtures): fall back to the
    // legacy normalized-z estimate.
    spineYaw = (rightShoulder.z - leftShoulder.z) * 3
  }

  // Roll: right shoulder lower = positive roll (leaning right)
  const spineRoll = (rightShoulder.y - leftShoulder.y) * 2

  // Pitch: disabled for now - the shoulder/hip z-offset creates a constant bias
  // that makes the avatar bow even when standing straight
  // TODO: Implement proper calibration or use relative motion instead
  const spinePitch = 0

  // Solve arm rotations using direct approach
  const leftArmResult = solveArm(leftShoulder, leftElbow, leftWrist, true)
  const rightArmResult = solveArm(rightShoulder, rightElbow, rightWrist, false)

  return {
    spine: { pitch: spinePitch, yaw: spineYaw, roll: spineRoll },
    leftArm: leftArmResult,
    rightArm: rightArmResult,
  }
}
