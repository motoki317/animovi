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

export function solvePose(landmarks: PoseLandmarks): PoseResult | null {
  if (landmarks.length === 0) {
    return null
  }

  const leftShoulder = landmarks[LEFT_SHOULDER]
  const rightShoulder = landmarks[RIGHT_SHOULDER]

  // Calculate spine yaw from shoulder z-difference
  // Right shoulder forward = positive yaw (body turned right)
  const spineYaw = (rightShoulder.z - leftShoulder.z) * 5

  return {
    spine: { pitch: 0, yaw: spineYaw, roll: 0 },
    leftArm: {
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: 0 },
    },
  }
}
