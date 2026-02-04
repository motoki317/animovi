/**
 * Two-Bone Inverse Kinematics Solver
 *
 * Solves for shoulder and elbow rotations given a wrist target position.
 * Uses analytical solution (law of cosines) for exact, fast computation.
 *
 * Coordinate system (VRM/Three.js):
 * - Y-up, right-handed
 * - T-pose: arms horizontal, pointing along ±X axis
 */

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface TwoBoneIKInput {
  /** Shoulder position in world space */
  shoulder: Vector3
  /** Target wrist position in world space */
  target: Vector3
  /** Upper arm length (shoulder to elbow) */
  upperArmLength: number
  /** Lower arm length (elbow to wrist) */
  lowerArmLength: number
  /** Hint for elbow direction (pole vector) - typically the detected elbow position */
  poleHint: Vector3
  /** Whether this is the left arm */
  isLeft: boolean
}

export interface TwoBoneIKResult {
  /** Shoulder rotation in euler angles (pitch=X, yaw=Y, roll=Z) */
  shoulder: { x: number; y: number; z: number }
  /** Elbow rotation (only X for bend) */
  elbow: { x: number; y: number; z: number }
  /** Whether the target was reachable */
  reachable: boolean
}

/**
 * Normalize a vector
 */
function normalize(v: Vector3): Vector3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/**
 * Vector subtraction: a - b
 */
function sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

/**
 * Dot product
 */
function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/**
 * Cross product
 */
function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

/**
 * Vector length
 */
function length(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/**
 * Scale vector
 */
function scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

/**
 * Add vectors
 */
function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Solve two-bone IK using analytical method (law of cosines).
 *
 * Given:
 * - Shoulder position (chain root)
 * - Target wrist position
 * - Upper and lower arm lengths
 * - Pole hint (elbow direction preference)
 *
 * Returns shoulder and elbow rotations that place the wrist at the target.
 */
export function solveTwoBoneIK(input: TwoBoneIKInput): TwoBoneIKResult {
  const { shoulder, target, upperArmLength, lowerArmLength, poleHint, isLeft } = input

  // Vector from shoulder to target
  const toTarget = sub(target, shoulder)
  const targetDist = length(toTarget)

  // Check reachability
  const maxReach = upperArmLength + lowerArmLength - 0.001
  const minReach = Math.abs(upperArmLength - lowerArmLength) + 0.001
  const reachable = targetDist >= minReach && targetDist <= maxReach

  // Clamp distance to reachable range
  const clampedDist = clamp(targetDist, minReach, maxReach)

  // Direction to target (normalized)
  const targetDir = targetDist > 0.001 ? normalize(toTarget) : { x: isLeft ? -1 : 1, y: 0, z: 0 }

  // === Calculate elbow bend angle using law of cosines ===
  // c² = a² + b² - 2ab·cos(C)
  // where: a = upperArmLength, b = lowerArmLength, c = clampedDist
  const cosElbowAngle =
    (upperArmLength * upperArmLength + lowerArmLength * lowerArmLength - clampedDist * clampedDist) /
    (2 * upperArmLength * lowerArmLength)

  // Elbow angle (0 = straight, π = fully bent backward - not physically possible)
  // We want the interior angle at elbow, which is π - angle
  const elbowInteriorAngle = Math.acos(clamp(cosElbowAngle, -1, 1))
  // Elbow bend: how much it bends from straight (0 = straight, positive = bent)
  const elbowBend = Math.PI - elbowInteriorAngle

  // === Calculate shoulder angle offset (angle between upper arm and target direction) ===
  // Using law of cosines again to find angle at shoulder
  const cosShoulderOffset =
    (upperArmLength * upperArmLength + clampedDist * clampedDist - lowerArmLength * lowerArmLength) /
    (2 * upperArmLength * clampedDist)
  const shoulderOffset = Math.acos(clamp(cosShoulderOffset, -1, 1))

  // === Determine the plane of the arm using pole vector ===
  // The pole hint tells us which way the elbow should point

  // Vector from shoulder to pole hint
  const toPole = sub(poleHint, shoulder)

  // Project pole hint onto plane perpendicular to target direction
  // This gives us the "bend direction" for the elbow
  const poleAlongTarget = dot(toPole, targetDir)
  const polePerp = sub(toPole, scale(targetDir, poleAlongTarget))
  const polePerpLen = length(polePerp)

  // Default bend direction if pole hint is along target line
  let bendDir: Vector3
  if (polePerpLen < 0.001) {
    // Pole hint is along target direction, use default (elbow points backward/down)
    // Create a perpendicular vector - prefer Y-down, then Z-back
    if (Math.abs(targetDir.y) < 0.9) {
      bendDir = normalize(cross(targetDir, { x: 0, y: -1, z: 0 }))
      bendDir = normalize(cross(bendDir, targetDir))
    } else {
      bendDir = normalize(cross(targetDir, { x: 0, y: 0, z: -1 }))
      bendDir = normalize(cross(bendDir, targetDir))
    }
  } else {
    bendDir = normalize(polePerp)
  }

  // === Calculate elbow position ===
  // Upper arm direction: rotate targetDir toward bendDir by shoulderOffset
  // Using Rodrigues' rotation formula simplified for this case

  // The elbow lies on a circle around the target direction axis
  // at distance upperArmLength from shoulder and at angle shoulderOffset from targetDir

  // Rotation axis is perpendicular to both targetDir and bendDir
  const rotAxis = normalize(cross(targetDir, bendDir))

  // Upper arm direction using angle-axis rotation
  // upperArmDir = targetDir * cos(offset) + bendDir * sin(offset)
  const cosOffset = Math.cos(shoulderOffset)
  const sinOffset = Math.sin(shoulderOffset)
  const upperArmDir = add(scale(targetDir, cosOffset), scale(bendDir, sinOffset))

  // === Convert upperArmDir to VRM Euler angles using proper rotation math ===
  //
  // VRM T-pose: arms point along ±X axis (horizontal)
  // We need the rotation that takes the T-pose direction to upperArmDir
  //
  // This uses axis-angle → quaternion → Euler conversion for accuracy.
  // Linear component mapping only works for small angles and produces
  // wrong results for larger arm movements.

  // T-pose arm direction in VRM/MediaPipe space
  // Note: In mirrored view, person's left arm appears on right side of screen
  // MediaPipe X increases left-to-right, so left arm points toward higher X (positive)
  // and right arm points toward lower X (negative) when in T-pose
  const tposeDir: Vector3 = isLeft ? { x: 1, y: 0, z: 0 } : { x: -1, y: 0, z: 0 }

  // Calculate axis-angle rotation from T-pose to target direction
  const dotProduct = dot(tposeDir, upperArmDir)
  const crossProduct = cross(tposeDir, upperArmDir)
  const crossLen = length(crossProduct)

  let shoulderX = 0
  let shoulderY = 0
  let shoulderZ = 0

  if (crossLen < 0.001) {
    // Vectors are parallel (same direction or opposite)
    if (dotProduct > 0) {
      // Same direction - no rotation needed (arm at T-pose)
      shoulderX = 0
      shoulderY = 0
      shoulderZ = 0
    } else {
      // Opposite direction - 180° rotation around an arbitrary perpendicular axis
      // For arms, rotating 180° around Y would flip the arm
      shoulderX = 0
      shoulderY = 0
      shoulderZ = isLeft ? Math.PI : -Math.PI
    }
  } else {
    // General case: compute rotation via quaternion
    const axis = normalize(crossProduct)
    const angle = Math.acos(clamp(dotProduct, -1, 1))

    // Axis-angle to quaternion
    const halfAngle = angle / 2
    const sinHalf = Math.sin(halfAngle)
    const cosHalf = Math.cos(halfAngle)
    const qx = axis.x * sinHalf
    const qy = axis.y * sinHalf
    const qz = axis.z * sinHalf
    const qw = cosHalf

    // Quaternion to Euler angles (XYZ order, which Three.js uses by default)
    // Reference: https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToEuler/

    // Roll (X-axis rotation)
    const sinr_cosp = 2 * (qw * qx + qy * qz)
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy)
    shoulderX = Math.atan2(sinr_cosp, cosr_cosp)

    // Pitch (Y-axis rotation)
    const sinp = 2 * (qw * qy - qz * qx)
    if (Math.abs(sinp) >= 1) {
      // Gimbal lock - use 90 degrees
      shoulderY = (Math.PI / 2) * Math.sign(sinp)
    } else {
      shoulderY = Math.asin(sinp)
    }

    // Yaw (Z-axis rotation)
    const siny_cosp = 2 * (qw * qz + qx * qy)
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz)
    shoulderZ = Math.atan2(siny_cosp, cosy_cosp)
  }

  // Apply arm-side-specific adjustments if needed
  // The quaternion conversion already handles the direction correctly
  // based on the T-pose direction we specified

  return {
    shoulder: {
      x: shoulderX,
      y: shoulderY,
      z: shoulderZ,
    },
    elbow: {
      x: -elbowBend, // Negative X for elbow flexion in VRM
      y: 0,
      z: 0,
    },
    reachable,
  }
}

/**
 * Calculate arm segment lengths from landmark positions.
 * Call this during calibration to get arm lengths.
 */
export function calculateArmLengths(
  shoulder: Vector3,
  elbow: Vector3,
  wrist: Vector3
): { upperArmLength: number; lowerArmLength: number } {
  const upperArmLength = length(sub(elbow, shoulder))
  const lowerArmLength = length(sub(wrist, elbow))
  return { upperArmLength, lowerArmLength }
}
