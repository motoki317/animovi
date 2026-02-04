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

function calculateFingerCurl(landmarks: HandLandmarks, fingerIndices: number[]): number {
  const [mcp, pip, dip, tip] = fingerIndices.map((i) => landmarks[i])

  // Calculate curl based on how much the finger bends back toward MCP
  // Extended finger: tip is far from MCP in Y direction
  // Curled finger: tip is close to or past MCP in Y direction
  const fingerLength = Math.abs(pip.y - mcp.y) + Math.abs(dip.y - pip.y) + Math.abs(tip.y - dip.y)
  const directDistance = Math.abs(tip.y - mcp.y)

  // Ratio of direct distance to total finger length
  // Extended = ~1.0, Curled = ~0.0
  const extensionRatio = fingerLength > 0 ? directDistance / fingerLength : 0

  // Invert: 0 = extended, 1 = curled
  return Math.max(0, Math.min(1, 1 - extensionRatio))
}

export function solveHand(landmarks: HandLandmarks, _side: HandSide): HandResult | null {
  if (landmarks.length === 0) {
    return null
  }

  return {
    thumb: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.thumb), spread: 0 },
    index: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.index), spread: 0 },
    middle: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.middle), spread: 0 },
    ring: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.ring), spread: 0 },
    pinky: { curl: calculateFingerCurl(landmarks, FINGER_INDICES.pinky), spread: 0 },
  }
}
