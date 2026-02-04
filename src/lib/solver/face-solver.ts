/**
 * Face Solver - Extracts head rotation and blendshapes from face landmarks.
 */

export interface FaceLandmark {
  x: number
  y: number
  z: number
}

export type FaceLandmarks = FaceLandmark[]

export interface FaceResult {
  head: {
    pitch: number
    yaw: number
    roll: number
  }
  eyes: {
    leftBlink: number
    rightBlink: number
  }
  mouth: {
    open: number
    smile: number
  }
}

// MediaPipe landmark indices
const NOSE_TIP = 1
const CENTER_X = 0.5

export function solveFace(landmarks: FaceLandmarks): FaceResult | null {
  if (landmarks.length === 0) {
    return null
  }

  // Calculate yaw from nose position relative to center
  const nose = landmarks[NOSE_TIP]
  const yaw = (CENTER_X - nose.x) * 2 // Scale factor for sensitivity

  return {
    head: { pitch: 0, yaw, roll: 0 },
    eyes: { leftBlink: 0, rightBlink: 0 },
    mouth: { open: 0, smile: 0 },
  }
}
