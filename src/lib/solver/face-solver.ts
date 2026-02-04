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
const FOREHEAD = 10
const CHIN = 152
const CENTER_X = 0.5

export function solveFace(landmarks: FaceLandmarks): FaceResult | null {
  if (landmarks.length === 0) {
    return null
  }

  const nose = landmarks[NOSE_TIP]
  const forehead = landmarks[FOREHEAD]
  const chin = landmarks[CHIN]

  // Calculate yaw from nose position relative to center
  const yaw = (CENTER_X - nose.x) * 2

  // Calculate pitch from forehead-chin z difference
  // Positive z difference (forehead forward) = head tilting down = negative pitch
  const pitch = (chin.z - forehead.z) * 5

  return {
    head: { pitch, yaw, roll: 0 },
    eyes: { leftBlink: 0, rightBlink: 0 },
    mouth: { open: 0, smile: 0 },
  }
}
