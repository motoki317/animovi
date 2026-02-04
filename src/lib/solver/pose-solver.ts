/**
 * Pose Solver - Extracts body rotations from pose landmarks using IK.
 *
 * Uses inverse kinematics to solve arm rotations from wrist target positions.
 * This allows hand movement to drive arm pose even when elbow doesn't move much.
 */

import { solveTwoBoneIK, calculateArmLengths, type Vector3 } from '../math/two-bone-ik'

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

// Calibration state for arm lengths
// These are learned from the first few frames of tracking
interface ArmCalibration {
  upperArmLength: number
  lowerArmLength: number
  sampleCount: number
}

const CALIBRATION_SAMPLES = 10
const leftArmCalibration: ArmCalibration = { upperArmLength: 0, lowerArmLength: 0, sampleCount: 0 }
const rightArmCalibration: ArmCalibration = { upperArmLength: 0, lowerArmLength: 0, sampleCount: 0 }

/**
 * Update arm length calibration with new sample.
 * Uses running average of first N samples.
 */
function updateCalibration(
  calibration: ArmCalibration,
  shoulder: Vector3,
  elbow: Vector3,
  wrist: Vector3
): void {
  if (calibration.sampleCount >= CALIBRATION_SAMPLES) {
    return // Already calibrated
  }

  const { upperArmLength, lowerArmLength } = calculateArmLengths(shoulder, elbow, wrist)

  // Running average
  const n = calibration.sampleCount
  calibration.upperArmLength = (calibration.upperArmLength * n + upperArmLength) / (n + 1)
  calibration.lowerArmLength = (calibration.lowerArmLength * n + lowerArmLength) / (n + 1)
  calibration.sampleCount++
}

/**
 * Check if calibration is complete
 */
function isCalibrated(calibration: ArmCalibration): boolean {
  return calibration.sampleCount >= CALIBRATION_SAMPLES
}

/**
 * Solve arm rotations using inverse kinematics.
 *
 * Takes the wrist position as the IK target and uses the detected elbow
 * position as a pole hint for natural elbow orientation.
 */
function solveArmIK(
  shoulder: PoseLandmark,
  elbow: PoseLandmark,
  wrist: PoseLandmark,
  calibration: ArmCalibration,
  isLeft: boolean
): { shoulder: { x: number; y: number; z: number }; elbow: { x: number; y: number; z: number } } {
  // Transform MediaPipe coordinates to VRM-compatible space
  // MediaPipe (mirrored webcam): X 0-1 left-to-right, Y 0-1 top-to-bottom, Z negative toward camera
  // VRM: X positive = person's right, Y positive = up, Z positive = toward viewer
  //
  // In mirrored view, person's left appears on right side of image (higher X).
  // So higher MediaPipe X = person's left = VRM's negative X direction.
  // We need to flip X to un-mirror, plus flip Y and Z for coordinate system.
  const toVRMSpace = (p: PoseLandmark): Vector3 => ({
    x: -(p.x - 0.5),  // Flip X around center to un-mirror
    y: -p.y,          // Flip Y (MediaPipe Y-down to VRM Y-up)
    z: -p.z,          // Flip Z (MediaPipe Z-negative-forward to VRM Z-positive-forward)
  })

  const shoulderVRM = toVRMSpace(shoulder)
  const elbowVRM = toVRMSpace(elbow)
  const wristVRM = toVRMSpace(wrist)

  // Update calibration with transformed coordinates
  updateCalibration(calibration, shoulderVRM, elbowVRM, wristVRM)

  // If not yet calibrated, use current frame's measurements
  let upperLen = calibration.upperArmLength
  let lowerLen = calibration.lowerArmLength

  if (!isCalibrated(calibration)) {
    const lengths = calculateArmLengths(shoulderVRM, elbowVRM, wristVRM)
    upperLen = lengths.upperArmLength
    lowerLen = lengths.lowerArmLength
  }

  // Sanity check - avoid zero lengths
  if (upperLen < 0.001 || lowerLen < 0.001) {
    return {
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: 0 },
    }
  }

  // Solve IK with transformed coordinates
  const result = solveTwoBoneIK({
    shoulder: shoulderVRM,
    target: wristVRM,
    upperArmLength: upperLen,
    lowerArmLength: lowerLen,
    poleHint: elbowVRM,
    isLeft,
  })

  return {
    shoulder: result.shoulder,
    elbow: result.elbow,
  }
}

/**
 * Reset arm calibration (call when user changes or tracking restarts)
 */
export function resetArmCalibration(): void {
  leftArmCalibration.upperArmLength = 0
  leftArmCalibration.lowerArmLength = 0
  leftArmCalibration.sampleCount = 0
  rightArmCalibration.upperArmLength = 0
  rightArmCalibration.lowerArmLength = 0
  rightArmCalibration.sampleCount = 0
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

  // Solve arm rotations using IK
  const leftArmResult = solveArmIK(leftShoulder, leftElbow, leftWrist, leftArmCalibration, true)
  const rightArmResult = solveArmIK(rightShoulder, rightElbow, rightWrist, rightArmCalibration, false)

  return {
    spine: { pitch: spinePitch, yaw: spineYaw, roll: spineRoll },
    leftArm: leftArmResult,
    rightArm: rightArmResult,
  }
}
