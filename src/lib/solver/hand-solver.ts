/**
 * Hand Solver - Extracts finger rotations from hand landmarks.
 */

export interface HandLandmark {
  x: number
  y: number
  z: number
}

export type HandLandmarks = HandLandmark[]

export type HandSide = 'left' | 'right'

export interface FingerRotation {
  curl: number // 0 = extended, 1 = fully curled
  spread: number // lateral spread from center
}

export interface HandResult {
  thumb: FingerRotation
  index: FingerRotation
  middle: FingerRotation
  ring: FingerRotation
  pinky: FingerRotation
}

export function solveHand(landmarks: HandLandmarks, _side: HandSide): HandResult | null {
  if (landmarks.length === 0) {
    return null
  }
  return {} as HandResult
}
