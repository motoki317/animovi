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

/**
 * Calculate the angle (in radians) of MCP→TIP direction in the XY plane.
 * Returns atan2 of the X deviation relative to the Y direction.
 */
function fingerAngle(landmarks: HandLandmarks, fingerIndices: number[]): number {
  const mcp = landmarks[fingerIndices[0]]
  const tip = landmarks[fingerIndices[3]]
  const dx = tip.x - mcp.x
  const dy = mcp.y - tip.y // Flip Y since MediaPipe Y goes down
  // Angle relative to straight up (0 = straight up, positive = rightward)
  return Math.atan2(dx, Math.max(dy, 0.001))
}

/**
 * Calculate lateral finger spread for all fingers.
 * Spread is measured as the deviation of each finger's direction from the
 * middle finger's direction. Positive = splayed away from middle toward pinky side,
 * negative = splayed toward thumb side.
 * Values are normalized to approximately [-1, 1] range.
 */
function calculateFingerSpreads(landmarks: HandLandmarks): Record<string, number> {
  const middleAngle = fingerAngle(landmarks, FINGER_INDICES.middle)

  const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
  const result: Record<string, number> = {}

  // Max spread angle for normalization (~45 degrees)
  const maxSpreadAngle = Math.PI / 4

  for (const name of fingerNames) {
    const angle = fingerAngle(landmarks, FINGER_INDICES[name])
    const deviation = angle - middleAngle
    // Normalize and clamp to [-1, 1]
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
