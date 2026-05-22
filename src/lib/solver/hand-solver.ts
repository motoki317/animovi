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

// Finger landmark indices (MediaPipe Hand)
// Each finger has 4 landmarks: MCP, PIP, DIP, TIP
const FINGER_INDICES = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
}

interface V3 {
  x: number
  y: number
  z: number
}

function sub(a: V3 | HandLandmark, b: V3 | HandLandmark): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function vlen(v: V3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

function vnorm(v: V3): V3 {
  const l = vlen(v)
  if (l < 1e-9) return { x: 0, y: 0, z: 0 }
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

function vdot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function vcross(a: V3, b: V3): V3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function angleBetween(a: V3, b: V3): number {
  if (vlen(a) < 1e-6 || vlen(b) < 1e-6) return 0
  const cosA = vdot(vnorm(a), vnorm(b))
  return Math.acos(Math.max(-1, Math.min(1, cosA)))
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * 3D finger curl: sum of joint bend angles, normalized to [0, 1].
 * Replaces the old Y-axis-only metric, which degenerated to ~0 whenever the
 * palm faced the camera (fingers curled along Z, not Y).
 */
function calculateFingerCurl(landmarks: HandLandmarks, fingerIndices: number[]): number {
  const [mcp, pip, dip, tip] = fingerIndices.map((i) => landmarks[i])
  const v1 = sub(pip, mcp)
  const v2 = sub(dip, pip)
  const v3 = sub(tip, dip)
  // Bend at PIP + bend at DIP joints. Each is 0 when straight, ~π/2 when fully bent.
  const totalBend = angleBetween(v1, v2) + angleBetween(v2, v3)
  // Normalize: π is the practical max (≈ both joints folded 90°).
  return clamp01(totalBend / Math.PI)
}

/**
 * Lateral finger spread, measured in the palm plane defined by wrist + MCP landmarks.
 * Positive = splayed toward the pinky side; negative = toward the thumb side.
 * Works regardless of palm orientation (palm-at-camera doesn't degenerate).
 */
function calculateFingerSpreads(landmarks: HandLandmarks): Record<string, number> {
  const wrist = landmarks[0]
  const indexMCP = landmarks[FINGER_INDICES.index[0]]
  const middleMCP = landmarks[FINGER_INDICES.middle[0]]
  const pinkyMCP = landmarks[FINGER_INDICES.pinky[0]]

  // Palm-plane frame:
  //   axisU = wrist → middleMCP (along the fingers)
  //   axisV = in palm plane, perpendicular to U, pointing from index toward pinky
  const axisU = vnorm(sub(middleMCP, wrist))
  const sideRaw = sub(pinkyMCP, indexMCP)
  const palmNormal = vnorm(vcross(axisU, sideRaw))
  const axisV = vnorm(vcross(palmNormal, axisU))

  const middleDir = vnorm(sub(landmarks[FINGER_INDICES.middle[3]], middleMCP))
  const middleAngle = Math.atan2(vdot(middleDir, axisV), vdot(middleDir, axisU))

  const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
  const maxSpreadAngle = Math.PI / 4
  const result: Record<string, number> = {}

  for (const name of fingerNames) {
    const idx = FINGER_INDICES[name]
    const fingerDir = vnorm(sub(landmarks[idx[3]], landmarks[idx[0]]))
    const angle = Math.atan2(vdot(fingerDir, axisV), vdot(fingerDir, axisU))
    const deviation = angle - middleAngle
    result[name] = Math.max(-1, Math.min(1, deviation / maxSpreadAngle))
  }
  return result
}

export function solveHand(landmarks: HandLandmarks, _side: HandSide): HandResult | null {
  if (landmarks.length === 0) {
    return null
  }

  // Calculate spread for each finger
  const spreads = calculateFingerSpreads(landmarks)

  return {
    thumb: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.thumb), spread: spreads.thumb },
    index: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.index), spread: spreads.index },
    middle: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.middle), spread: spreads.middle },
    ring: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.ring), spread: spreads.ring },
    pinky: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.pinky), spread: spreads.pinky },
  }
}
