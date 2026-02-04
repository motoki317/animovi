/**
 * Pose Solver - Extracts body rotations from pose landmarks.
 */

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
 * Calculate arm rotations from shoulder, elbow, wrist positions.
 *
 * VRM coordinate system (Y-up, right-handed):
 * - T-pose: arms horizontal, pointing along ±X axis
 * - Shoulder Z rotation: lifts arm up (positive) or down (negative) from T-pose
 * - Shoulder X rotation: moves arm forward (positive) or backward (negative)
 * - Shoulder Y rotation: twists the arm
 *
 * MediaPipe normalized coordinates:
 * - X: 0 (left edge) to 1 (right edge) - mirrored, so person's left is at higher X
 * - Y: 0 (top) to 1 (bottom)
 * - Z: depth, negative = closer to camera
 */
function solveArm(
  shoulder: PoseLandmark,
  elbow: PoseLandmark,
  wrist: PoseLandmark,
  isLeft: boolean
): { shoulder: { x: number; y: number; z: number }; elbow: { x: number; y: number; z: number } } {
  // Vector from shoulder to elbow (upper arm direction)
  const upperArm = {
    x: elbow.x - shoulder.x,
    y: elbow.y - shoulder.y,
    z: elbow.z - shoulder.z,
  }

  // Vector from elbow to wrist (lower arm direction)
  const lowerArm = {
    x: wrist.x - elbow.x,
    y: wrist.y - elbow.y,
    z: wrist.z - elbow.z,
  }

  // Normalize vectors
  const upperArmLen = Math.sqrt(upperArm.x ** 2 + upperArm.y ** 2 + upperArm.z ** 2)
  const lowerArmLen = Math.sqrt(lowerArm.x ** 2 + lowerArm.y ** 2 + lowerArm.z ** 2)

  if (upperArmLen === 0 || lowerArmLen === 0) {
    return {
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: 0 },
    }
  }

  // Normalized upper arm direction
  const upperArmDir = {
    x: upperArm.x / upperArmLen,
    y: upperArm.y / upperArmLen,
    z: upperArm.z / upperArmLen,
  }

  // Shoulder Z rotation: how much arm is raised/lowered from horizontal
  // In MediaPipe, Y increases downward, so positive upperArm.y means arm pointing down
  // VRM: positive Z rotation raises the arm for left, lowers for right
  const armDownAmount = upperArmDir.y // -1 (up) to +1 (down)
  const shoulderZ = isLeft
    ? armDownAmount * (Math.PI / 2)  // Left arm: down = positive Z
    : -armDownAmount * (Math.PI / 2) // Right arm: down = negative Z

  // Shoulder X rotation: how much arm is forward/backward
  // In MediaPipe, negative Z = closer to camera = arm forward
  const armForwardAmount = -upperArmDir.z // positive = forward
  const shoulderX = armForwardAmount * (Math.PI / 3) // Limit to 60 degrees

  // Shoulder Y rotation (twist): determines where the elbow points
  // Calculate by finding the angle of the forearm in the plane perpendicular to upper arm
  // Project forearm onto plane perpendicular to upper arm, then find its angle

  // First, get component of forearm along upper arm direction
  const forearmAlongUpperArm =
    (lowerArm.x * upperArmDir.x + lowerArm.y * upperArmDir.y + lowerArm.z * upperArmDir.z)

  // Subtract to get the perpendicular component (forearm projected onto perpendicular plane)
  const forearmPerp = {
    x: lowerArm.x - forearmAlongUpperArm * upperArmDir.x,
    y: lowerArm.y - forearmAlongUpperArm * upperArmDir.y,
    z: lowerArm.z - forearmAlongUpperArm * upperArmDir.z,
  }

  const forearmPerpLen = Math.sqrt(forearmPerp.x ** 2 + forearmPerp.y ** 2 + forearmPerp.z ** 2)

  let shoulderY = 0
  if (forearmPerpLen > 0.01) {
    // Calculate twist angle based on forearm's perpendicular direction
    // Use atan2 with the y and z components of the perpendicular forearm
    // This gives us how much the elbow is rotated around the arm axis
    // Flip the sign to correct the twist direction
    shoulderY = Math.atan2(-forearmPerp.z, forearmPerp.y) * (isLeft ? 1 : -1)

    // Clamp to reasonable range
    shoulderY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, shoulderY))
  }

  // Elbow bend: angle between upper and lower arm vectors
  const dot = (upperArm.x * lowerArm.x + upperArm.y * lowerArm.y + upperArm.z * lowerArm.z)
            / (upperArmLen * lowerArmLen)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
  // Elbow only bends one way (flexion), angle of 0 = straight, PI = fully bent
  const elbowBend = Math.PI - angle

  return {
    shoulder: { x: shoulderX, y: shoulderY, z: shoulderZ },
    elbow: { x: -elbowBend, y: 0, z: 0 }, // Negative X for elbow flexion in VRM
  }
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

  // Solve arm rotations
  const leftArmResult = solveArm(leftShoulder, leftElbow, leftWrist, true)
  const rightArmResult = solveArm(rightShoulder, rightElbow, rightWrist, false)

  return {
    spine: { pitch: spinePitch, yaw: spineYaw, roll: spineRoll },
    leftArm: leftArmResult,
    rightArm: rightArmResult,
  }
}
