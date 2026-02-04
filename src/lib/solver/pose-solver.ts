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

export function solvePose(landmarks: PoseLandmarks): PoseResult | null {
  if (landmarks.length === 0) {
    return null
  }
  return {} as PoseResult
}
