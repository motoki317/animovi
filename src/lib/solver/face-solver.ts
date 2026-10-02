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
    /** From the image-left eye, the subject's right eye. See the index note below. */
    leftBlink: number
    /** From the image-right eye, the subject's left eye. */
    rightBlink: number
    gazeX: number // -1 = looking left, 0 = center, 1 = looking right (image space)
    gazeY: number // -1 = looking down, 0 = center, 1 = looking up
  }
  mouth: {
    open: number
    smile: number
  }
}

// MediaPipe Face Mesh indices. LEFT_* and RIGHT_* name image sides. The LEFT_*
// indices belong to FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, the subject's
// right eye, which an unflipped camera frame shows on the left.
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
const LEFT_EYE_OUTER = 33
const RIGHT_EYE_OUTER = 263
const LEFT_EYE_INNER = 133
const RIGHT_EYE_INNER = 362
const CENTER_X = 0.5
// Distances in normalized image units.
const EYE_OPEN_THRESHOLD = 0.02 // Typical open eye gap
const MOUTH_OPEN_THRESHOLD = 0.1 // Max mouth opening
const MOUTH_WIDTH_NEUTRAL = 0.2 // Typical neutral mouth width
const MOUTH_WIDTH_SMILE = 0.35 // Typical smile width

// Only the 478-landmark model has these: 468 base landmarks plus 10 iris landmarks.
const LEFT_IRIS_CENTER = 468
const RIGHT_IRIS_CENTER = 473

/**
 * Iris offset from the eye-socket center, over the socket's half-size, in
 * [-1, 1]. The two eyes are averaged to reduce noise.
 */
function calculateGaze(landmarks: FaceLandmarks): { gazeX: number; gazeY: number } {
  if (landmarks.length <= LEFT_IRIS_CENTER) {
    return { gazeX: 0, gazeY: 0 }
  }

  const leftIris = landmarks[LEFT_IRIS_CENTER]
  const rightIris = landmarks[RIGHT_IRIS_CENTER]

  const leftEyeCenterX = (landmarks[LEFT_EYE_OUTER].x + landmarks[LEFT_EYE_INNER].x) / 2
  const leftEyeCenterY = (landmarks[LEFT_EYE_UPPER].y + landmarks[LEFT_EYE_LOWER].y) / 2
  const rightEyeCenterX = (landmarks[RIGHT_EYE_OUTER].x + landmarks[RIGHT_EYE_INNER].x) / 2
  const rightEyeCenterY = (landmarks[RIGHT_EYE_UPPER].y + landmarks[RIGHT_EYE_LOWER].y) / 2

  const leftEyeHalfWidth = Math.abs(landmarks[LEFT_EYE_INNER].x - landmarks[LEFT_EYE_OUTER].x) / 2
  const rightEyeHalfWidth = Math.abs(landmarks[RIGHT_EYE_INNER].x - landmarks[RIGHT_EYE_OUTER].x) / 2
  const leftEyeHalfHeight = Math.abs(landmarks[LEFT_EYE_LOWER].y - landmarks[LEFT_EYE_UPPER].y) / 2
  const rightEyeHalfHeight = Math.abs(landmarks[RIGHT_EYE_LOWER].y - landmarks[RIGHT_EYE_UPPER].y) / 2

  const leftGazeX = leftEyeHalfWidth > 0.001 ? (leftIris.x - leftEyeCenterX) / leftEyeHalfWidth : 0
  const leftGazeY = leftEyeHalfHeight > 0.001 ? -(leftIris.y - leftEyeCenterY) / leftEyeHalfHeight : 0
  const rightGazeX = rightEyeHalfWidth > 0.001 ? (rightIris.x - rightEyeCenterX) / rightEyeHalfWidth : 0
  const rightGazeY = rightEyeHalfHeight > 0.001 ? -(rightIris.y - rightEyeCenterY) / rightEyeHalfHeight : 0

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

  // Positive yaw: the nose sits left of the image center. In an unflipped
  // camera frame, the subject turns to their right.
  const yaw = (CENTER_X - nose.x) * 2

  // Positive pitch: the forehead is farther from the camera than the chin
  // (MediaPipe z grows away from the camera), so the head tilts back.
  const pitch = (forehead.z - chin.z) * 5

  // Positive roll: the image-left eye corner sits higher, so the head tilts
  // toward the image's right.
  const roll = (rightEyeOuter.y - leftEyeOuter.y) * 4

  const leftEyeGap = landmarks[LEFT_EYE_LOWER].y - landmarks[LEFT_EYE_UPPER].y
  const rightEyeGap = landmarks[RIGHT_EYE_LOWER].y - landmarks[RIGHT_EYE_UPPER].y

  // 0 = open (gap at or above the threshold), 1 = closed (no gap)
  const leftBlink = Math.max(0, Math.min(1, 1 - leftEyeGap / EYE_OPEN_THRESHOLD))
  const rightBlink = Math.max(0, Math.min(1, 1 - rightEyeGap / EYE_OPEN_THRESHOLD))

  const { gazeX, gazeY } = calculateGaze(landmarks)

  const mouthGap = landmarks[LOWER_LIP].y - landmarks[UPPER_LIP].y
  const mouthOpen = Math.max(0, Math.min(1, mouthGap / MOUTH_OPEN_THRESHOLD))

  const mouthWidth = landmarks[MOUTH_RIGHT].x - landmarks[MOUTH_LEFT].x
  const smileRatio = (mouthWidth - MOUTH_WIDTH_NEUTRAL) / (MOUTH_WIDTH_SMILE - MOUTH_WIDTH_NEUTRAL)
  const smile = Math.max(0, Math.min(1, smileRatio))

  return {
    head: { pitch, yaw, roll },
    eyes: { leftBlink, rightBlink, gazeX, gazeY },
    mouth: { open: mouthOpen, smile },
  }
}
