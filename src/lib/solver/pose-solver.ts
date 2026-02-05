/**
 * Pose Solver - Extracts body rotations from pose landmarks.
 *
 * Uses direct vector-to-euler computation (KalidoKit-style) for arm rotations.
 * This approach directly uses the detected landmark positions rather than
 * solving inverse kinematics, which is simpler and more predictable.
 */

import { solveArmDirect, type Vector3 } from '../math/two-bone-ik'

export interface PoseLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export type PoseLandmarks = PoseLandmark[]

export interface PoseResult {
  spine: {
    pitch: number
    yaw: number
    roll: number
  }
  leftArm: {
    shoulder: { x: number; y: number; z: number }
    elbow: { x: number; y: number; z: number }
  }
  rightArm: {
    shoulder: { x: number; y: number; z: number }
    elbow: { x: number; y: number; z: number }
  }
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

/**
 * Transform MediaPipe coordinates to VRM-compatible space.
 *
 * MediaPipe (mirrored webcam): X 0-1 left-to-right, Y 0-1 top-to-bottom, Z negative toward camera
 * VRM: X positive = person's right, Y positive = up, Z positive = toward viewer
 *
 * In mirrored view, person's left appears on right side of image (higher X).
 * So higher MediaPipe X = person's left = VRM's negative X direction.
 * We need to flip X to un-mirror, plus flip Y and Z for coordinate system.
 */
function toVRMSpace(p: PoseLandmark): Vector3 {
  return {
    x: -(p.x - 0.5), // Flip X around center to un-mirror
    y: -p.y, // Flip Y (MediaPipe Y-down to VRM Y-up)
    z: -p.z, // Flip Z (MediaPipe Z-negative-forward to VRM Z-positive-forward)
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
): { shoulder: { x: number; y: number; z: number }; elbow: { x: number; y: number; z: number } } {
  const shoulderVRM = toVRMSpace(shoulder)
  const elbowVRM = toVRMSpace(elbow)
  const wristVRM = toVRMSpace(wrist)

  const result = solveArmDirect({
    shoulder: shoulderVRM,
    elbow: elbowVRM,
    wrist: wristVRM,
    isLeft,
  })

  return {
    shoulder: result.shoulder,
    elbow: result.elbow,
  }
}

/**
 * Reset arm calibration (no-op for direct approach, kept for API compatibility)
 */
export function resetArmCalibration(): void {
  // Direct approach doesn't need calibration
}

export function solvePose(landmarks: PoseLandmarks): PoseResult | null {
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

  // Calculate spine rotation from shoulder positions
  // Yaw: right shoulder forward = positive yaw (body turned right)
  const spineYaw = (rightShoulder.z - leftShoulder.z) * 3

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
