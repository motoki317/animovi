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

/**
 * Detected hand orientation in solver world space.
 *
 * Two unit vectors — the hand's long axis (wrist→middleMCP) and the palm
 * normal (cross of two finger spans, sign-corrected per side) — together
 * fully determine the hand's 3D orientation. The bridge composes these with
 * the arm chain (shoulder + elbow Eulers) to derive the wrist bone's local
 * Euler via `R_handLocal = R_chain⁻¹ · R_target`.
 *
 * Using two axes (rather than just palm normal) is essential: a single-axis
 * approach is degenerate when palm normal aligns with the forearm — exactly
 * the case for "reaching forward, palm facing camera".
 */
export interface WristFrame {
  /** Hand's extending direction in solver space, unit vector. */
  handAxis: V3
  /** Palm normal in solver space (out of palm), unit vector. */
  palmNormal: V3
}

export interface HandResult {
  thumb: FingerRotation
  index: FingerRotation
  middle: FingerRotation
  ring: FingerRotation
  pinky: FingerRotation
  /** Detected hand orientation (hand axis + palm normal). Null when the
   * landmark geometry is degenerate. */
  wristFrame: WristFrame | null
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

function vscale(v: V3, s: number): V3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

export type Quat = [number, number, number, number] // [x, y, z, w]

/**
 * Three.js Euler('ZYX') → quaternion. Composition is qz · qy · qx (X applied
 * first, then Y, then Z), matching how three.js evaluates ZYX-order Eulers.
 */
export function eulerZYXToQuat(e: { x: number; y: number; z: number }): Quat {
  const cx = Math.cos(e.x * 0.5), sx = Math.sin(e.x * 0.5)
  const cy = Math.cos(e.y * 0.5), sy = Math.sin(e.y * 0.5)
  const cz = Math.cos(e.z * 0.5), sz = Math.sin(e.z * 0.5)
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    -sx * sy * cz + cx * cy * sz,
    cx * cy * cz + sx * sy * sz,
  ]
}

export function quatMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export function rotateVecByQuat(v: V3, q: Quat): V3 {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3]
  // v_rotated = v + 2 * qw * (q.xyz × v) + 2 * (q.xyz × (q.xyz × v))
  const tx = 2 * (qy * v.z - qz * v.y)
  const ty = 2 * (qz * v.x - qx * v.z)
  const tz = 2 * (qx * v.y - qy * v.x)
  return {
    x: v.x + qw * tx + (qy * tz - qz * ty),
    y: v.y + qw * ty + (qz * tx - qx * tz),
    z: v.z + qw * tz + (qx * ty - qy * tx),
  }
}

/**
 * MediaPipe Hand/Pose landmarks → VRM solver space.
 * Mirrors the same transform used by pose-solver.ts:toVRMSpace so the wrist
 * rotation we produce shares the sign convention of the arm Eulers.
 */
function toVRMPoint(p: { x: number; y: number; z: number }): V3 {
  return { x: -(p.x - 0.5), y: -p.y, z: p.z }
}

/** Same axis flips as toVRMPoint but for a direction vector (no recentering). */
function toVRMDir(d: { x: number; y: number; z: number }): V3 {
  return { x: -d.x, y: -d.y, z: d.z }
}

/**
 * Build the hand's orientation frame (handAxis, palmNormal) in solver space.
 * Returns null when landmark geometry is degenerate. The bridge consumes this
 * frame and the arm chain to compute the wrist bone's local Euler.
 */
function calculateWristFrame(landmarks: HandLandmarks, side: HandSide): WristFrame | null {
  const wrist = toVRMPoint(landmarks[0])
  const indexMCP = toVRMPoint(landmarks[FINGER_INDICES.index[0]])
  const middleMCP = toVRMPoint(landmarks[FINGER_INDICES.middle[0]])
  const pinkyMCP = toVRMPoint(landmarks[FINGER_INDICES.pinky[0]])

  const handAxisRaw = sub(middleMCP, wrist)
  if (vlen(handAxisRaw) < 1e-6) return null
  const handAxis = vnorm(handAxisRaw)

  // Cross product chirality: for LEFT hand, cross(wrist→index, wrist→pinky)
  // post-toVRMSpace points along the BACK-of-hand normal — flip to get palm
  // out-direction. For RIGHT hand the mirrored geometry gives palm normal
  // directly. (Verified by stepping through a "palm facing camera" pose.)
  const rawNormal = vcross(sub(indexMCP, wrist), sub(pinkyMCP, wrist))
  const sideSign = side === 'left' ? -1 : 1
  const palmNormal = vnorm(vscale(rawNormal, sideSign))
  if (vlen(palmNormal) < 1e-6) return null

  return { handAxis, palmNormal }
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

export function solveHand(landmarks: HandLandmarks, side: HandSide): HandResult | null {
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
    wristFrame: calculateWristFrame(landmarks, side),
  }
}
