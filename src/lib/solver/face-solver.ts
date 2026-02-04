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
const LEFT_EYE_UPPER = 159
const LEFT_EYE_LOWER = 145
const RIGHT_EYE_UPPER = 386
const RIGHT_EYE_LOWER = 374
const UPPER_LIP = 13
const LOWER_LIP = 14
const MOUTH_LEFT = 61
const MOUTH_RIGHT = 291
const CENTER_X = 0.5
const EYE_OPEN_THRESHOLD = 0.02 // Typical open eye gap
const MOUTH_OPEN_THRESHOLD = 0.1 // Max mouth opening
const MOUTH_WIDTH_NEUTRAL = 0.2 // Typical neutral mouth width
const MOUTH_WIDTH_SMILE = 0.35 // Typical smile width

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

  // Calculate eye blink from eyelid distance
  const leftEyeGap = landmarks[LEFT_EYE_LOWER].y - landmarks[LEFT_EYE_UPPER].y
  const rightEyeGap = landmarks[RIGHT_EYE_LOWER].y - landmarks[RIGHT_EYE_UPPER].y

  // Normalize: 0 = open (gap >= threshold), 1 = closed (gap = 0)
  const leftBlink = Math.max(0, Math.min(1, 1 - leftEyeGap / EYE_OPEN_THRESHOLD))
  const rightBlink = Math.max(0, Math.min(1, 1 - rightEyeGap / EYE_OPEN_THRESHOLD))

  // Calculate mouth open from lip distance
  const mouthGap = landmarks[LOWER_LIP].y - landmarks[UPPER_LIP].y
  const mouthOpen = Math.max(0, Math.min(1, mouthGap / MOUTH_OPEN_THRESHOLD))

  // Calculate smile from mouth width
  const mouthWidth = landmarks[MOUTH_RIGHT].x - landmarks[MOUTH_LEFT].x
  const smileRatio = (mouthWidth - MOUTH_WIDTH_NEUTRAL) / (MOUTH_WIDTH_SMILE - MOUTH_WIDTH_NEUTRAL)
  const smile = Math.max(0, Math.min(1, smileRatio))

  return {
    head: { pitch, yaw, roll: 0 },
    eyes: { leftBlink, rightBlink },
    mouth: { open: mouthOpen, smile },
  }
}
