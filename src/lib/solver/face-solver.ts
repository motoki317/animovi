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
    gazeX: number // -1 = looking left, 0 = center, 1 = looking right (image space)
    gazeY: number // -1 = looking down, 0 = center, 1 = looking up
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
// Landmarks for roll calculation (outer eye corners)
const LEFT_EYE_OUTER = 33
const RIGHT_EYE_OUTER = 263
const CENTER_X = 0.5
const EYE_OPEN_THRESHOLD = 0.02 // Typical open eye gap
const MOUTH_OPEN_THRESHOLD = 0.1 // Max mouth opening
const MOUTH_WIDTH_NEUTRAL = 0.2 // Typical neutral mouth width
const MOUTH_WIDTH_SMILE = 0.35 // Typical smile width

// Iris landmarks (MediaPipe 478-landmark model: 468 base + 10 iris)
const LEFT_IRIS_CENTER = 468
const RIGHT_IRIS_CENTER = 473
// Eye inner corners (for calculating eye socket center)
const LEFT_EYE_INNER = 133
const RIGHT_EYE_INNER = 362

/**
 * Calculate eye gaze direction from iris position relative to eye socket.
 * Averages both eyes for stability. Returns normalized values in [-1, 1].
 */
function calculateGaze(landmarks: FaceLandmarks): { gazeX: number; gazeY: number } {
  // Check if iris landmarks are available (478-landmark model)
  if (landmarks.length <= LEFT_IRIS_CENTER) {
    return { gazeX: 0, gazeY: 0 }
  }

  const leftIris = landmarks[LEFT_IRIS_CENTER]
  const rightIris = landmarks[RIGHT_IRIS_CENTER]

  // Calculate eye socket centers from inner and outer corners
  const leftEyeCenterX = (landmarks[LEFT_EYE_OUTER].x + landmarks[LEFT_EYE_INNER].x) / 2
  const leftEyeCenterY = (landmarks[LEFT_EYE_UPPER].y + landmarks[LEFT_EYE_LOWER].y) / 2
  const rightEyeCenterX = (landmarks[RIGHT_EYE_OUTER].x + landmarks[RIGHT_EYE_INNER].x) / 2
  const rightEyeCenterY = (landmarks[RIGHT_EYE_UPPER].y + landmarks[RIGHT_EYE_LOWER].y) / 2

  // Eye socket half-widths for normalization
  const leftEyeHalfWidth = Math.abs(landmarks[LEFT_EYE_INNER].x - landmarks[LEFT_EYE_OUTER].x) / 2
  const rightEyeHalfWidth = Math.abs(landmarks[RIGHT_EYE_INNER].x - landmarks[RIGHT_EYE_OUTER].x) / 2
  const leftEyeHalfHeight = Math.abs(landmarks[LEFT_EYE_LOWER].y - landmarks[LEFT_EYE_UPPER].y) / 2
  const rightEyeHalfHeight = Math.abs(landmarks[RIGHT_EYE_LOWER].y - landmarks[RIGHT_EYE_UPPER].y) / 2

  // Iris displacement from eye center, normalized by eye socket size
  const leftGazeX = leftEyeHalfWidth > 0.001 ? (leftIris.x - leftEyeCenterX) / leftEyeHalfWidth : 0
  const leftGazeY = leftEyeHalfHeight > 0.001 ? -(leftIris.y - leftEyeCenterY) / leftEyeHalfHeight : 0
  const rightGazeX = rightEyeHalfWidth > 0.001 ? (rightIris.x - rightEyeCenterX) / rightEyeHalfWidth : 0
  const rightGazeY = rightEyeHalfHeight > 0.001 ? -(rightIris.y - rightEyeCenterY) / rightEyeHalfHeight : 0

  // Average both eyes and clamp
  const gazeX = Math.max(-1, Math.min(1, (leftGazeX + rightGazeX) / 2))
  const gazeY = Math.max(-1, Math.min(1, (leftGazeY + rightGazeY) / 2))

  return { gazeX, gazeY }
}

export function solveFace(landmarks: FaceLandmarks): FaceResult | null {
  if (landmarks.length === 0) {
    return null
  }

  const nose = landmarks[NOSE_TIP]
  const forehead = landmarks[FOREHEAD]
  const chin = landmarks[CHIN]
  const leftEyeOuter = landmarks[LEFT_EYE_OUTER]
  const rightEyeOuter = landmarks[RIGHT_EYE_OUTER]

  // Calculate yaw from nose position relative to center
  // Nose moving left (smaller x) = head turning right = positive yaw
  const yaw = (CENTER_X - nose.x) * 2

  // Calculate pitch from forehead-chin z difference
  // Forehead forward (larger z) relative to chin = head tilting down = positive pitch
  // VRM bone convention: positive X rotation = head tilts forward (looking down)
  const pitch = (forehead.z - chin.z) * 5

  // Calculate roll from eye corner y-positions
  // Left eye higher than right = head tilting right = positive roll
  const roll = (rightEyeOuter.y - leftEyeOuter.y) * 4

  // Calculate eye blink from eyelid distance
  const leftEyeGap = landmarks[LEFT_EYE_LOWER].y - landmarks[LEFT_EYE_UPPER].y
  const rightEyeGap = landmarks[RIGHT_EYE_LOWER].y - landmarks[RIGHT_EYE_UPPER].y

  // Normalize: 0 = open (gap >= threshold), 1 = closed (gap = 0)
  const leftBlink = Math.max(0, Math.min(1, 1 - leftEyeGap / EYE_OPEN_THRESHOLD))
  const rightBlink = Math.max(0, Math.min(1, 1 - rightEyeGap / EYE_OPEN_THRESHOLD))

  // Calculate eye gaze from iris position relative to eye socket center
  const { gazeX, gazeY } = calculateGaze(landmarks)

  // Calculate mouth open from lip distance
  const mouthGap = landmarks[LOWER_LIP].y - landmarks[UPPER_LIP].y
  const mouthOpen = Math.max(0, Math.min(1, mouthGap / MOUTH_OPEN_THRESHOLD))

  // Calculate smile from mouth width
  const mouthWidth = landmarks[MOUTH_RIGHT].x - landmarks[MOUTH_LEFT].x
  const smileRatio = (mouthWidth - MOUTH_WIDTH_NEUTRAL) / (MOUTH_WIDTH_SMILE - MOUTH_WIDTH_NEUTRAL)
  const smile = Math.max(0, Math.min(1, smileRatio))

  return {
    head: { pitch, yaw, roll },
    eyes: { leftBlink, rightBlink, gazeX, gazeY },
    mouth: { open: mouthOpen, smile },
  }
}
