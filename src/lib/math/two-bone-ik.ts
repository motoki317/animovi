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

export interface TwoBoneIKResult {
  /** Shoulder rotation in euler angles (pitch=X, yaw=Y, roll=Z) */
  shoulder: { x: number; y: number; z: number }
  /** Elbow rotation (full 3DOF relative to upper arm) */
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
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Direct vector-to-euler arm solver (KalidoKit-style).
 *
 * Computes arm rotations directly from landmark positions without IK.
 * Uses actual shoulder→elbow and elbow→wrist directions.
 *
 * This is simpler and more predictable than IK because it directly uses
 * the detected landmark positions rather than solving for a target.
 */
export interface DirectArmInput {
  /** Shoulder position */
  shoulder: Vector3
  /** Elbow position */
  elbow: Vector3
  /** Wrist position */
  wrist: Vector3
  /** Whether this is the left arm */
  isLeft: boolean
}

/**
 * Convert a direction vector to ZYX Euler angles.
 * Computes the rotation that transforms 'from' direction to 'to' direction.
 */
function directionToEulerZYX(from: Vector3, to: Vector3): { x: number; y: number; z: number } {
  const fromNorm = normalize(from)
  const toNorm = normalize(to)

  // Handle zero-length vectors
  if (length(fromNorm) < 0.001 || length(toNorm) < 0.001) {
    return { x: 0, y: 0, z: 0 }
  }

  // Compute rotation quaternion
  const d = dot(fromNorm, toNorm)
  const c = cross(fromNorm, toNorm)
  const crossLen = length(c)

  if (crossLen < 0.001) {
    // Parallel vectors - no rotation or 180° rotation
    return d > 0 ? { x: 0, y: 0, z: 0 } : { x: 0, y: Math.PI, z: 0 }
  }

  const axis = normalize(c)
  const angle = Math.acos(clamp(d, -1, 1))

  // Axis-angle to quaternion
  const ha = angle / 2
  const qx = axis.x * Math.sin(ha)
  const qy = axis.y * Math.sin(ha)
  const qz = axis.z * Math.sin(ha)
  const qw = Math.cos(ha)

  // Quaternion to ZYX Euler
  const sinY = 2 * (qw * qy - qx * qz)
  if (Math.abs(sinY) >= 0.9999999) {
    // Gimbal lock
    return {
      x: 0,
      y: (Math.PI / 2) * Math.sign(sinY),
      z: Math.atan2(-(2 * (qx * qy - qw * qz)), 1 - 2 * (qx * qx + qz * qz)),
    }
  }

  return {
    x: Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)),
    y: Math.asin(sinY),
    z: Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)),
  }
}

/**
 * Build a rotation quaternion from two pairs of vectors:
 *   R · uLocal = uWorld
 *   R · nLocal = nWorld
 * The two pairs must satisfy uLocal ⊥ nLocal and uWorld ⊥ nWorld
 * (and matching handedness). Returns [qx, qy, qz, qw].
 */
export function rotationFromTwoPairs(
  uLocal: Vector3,
  nLocal: Vector3,
  uWorld: Vector3,
  nWorld: Vector3
): [number, number, number, number] {
  // Build orthonormal local frame columns (uL, nL, uL × nL)
  const tLocal = cross(uLocal, nLocal)
  const tWorld = cross(uWorld, nWorld)

  // R · localFrame = worldFrame  =>  R = worldFrame · localFrame⁻¹
  // localFrame and worldFrame are orthogonal matrices, so inverse = transpose.
  // R[i][j] = Σ_k worldFrame[i][k] · localFrame[j][k]
  //        = uWorld[i]·uLocal[j] + nWorld[i]·nLocal[j] + tWorld[i]·tLocal[j]
  const m00 = uWorld.x * uLocal.x + nWorld.x * nLocal.x + tWorld.x * tLocal.x
  const m01 = uWorld.x * uLocal.y + nWorld.x * nLocal.y + tWorld.x * tLocal.y
  const m02 = uWorld.x * uLocal.z + nWorld.x * nLocal.z + tWorld.x * tLocal.z
  const m10 = uWorld.y * uLocal.x + nWorld.y * nLocal.x + tWorld.y * tLocal.x
  const m11 = uWorld.y * uLocal.y + nWorld.y * nLocal.y + tWorld.y * tLocal.y
  const m12 = uWorld.y * uLocal.z + nWorld.y * nLocal.z + tWorld.y * tLocal.z
  const m20 = uWorld.z * uLocal.x + nWorld.z * nLocal.x + tWorld.z * tLocal.x
  const m21 = uWorld.z * uLocal.y + nWorld.z * nLocal.y + tWorld.z * tLocal.y
  const m22 = uWorld.z * uLocal.z + nWorld.z * nLocal.z + tWorld.z * tLocal.z

  // Matrix → quaternion (Shepperd / Shoemake; pick largest diagonal for stability)
  const trace = m00 + m11 + m22
  let qx: number, qy: number, qz: number, qw: number
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    qw = 0.25 * s
    qx = (m21 - m12) / s
    qy = (m02 - m20) / s
    qz = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    qw = (m21 - m12) / s
    qx = 0.25 * s
    qy = (m01 + m10) / s
    qz = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    qw = (m02 - m20) / s
    qx = (m01 + m10) / s
    qy = 0.25 * s
    qz = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    qw = (m10 - m01) / s
    qx = (m02 + m20) / s
    qy = (m12 + m21) / s
    qz = 0.25 * s
  }
  return [qx, qy, qz, qw]
}

/** Convert a unit quaternion to ZYX Euler (Three.js order 'ZYX'). */
export function quaternionToEulerZYX(q: [number, number, number, number]): { x: number; y: number; z: number } {
  const [qx, qy, qz, qw] = q
  const sinY = 2 * (qw * qy - qx * qz)
  if (Math.abs(sinY) >= 0.9999999) {
    return {
      x: 0,
      y: (Math.PI / 2) * Math.sign(sinY),
      z: Math.atan2(-(2 * (qx * qy - qw * qz)), 1 - 2 * (qx * qx + qz * qz)),
    }
  }
  return {
    x: Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)),
    y: Math.asin(sinY),
    z: Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)),
  }
}

/**
 * Solve arm rotations from landmark positions (KalidoKit-style 3DOF decomposition).
 *
 * Decomposition:
 *   - Shoulder = full 3DOF rotation: aligns the bone axis to shoulder→elbow,
 *     AND rolls the bone so the elbow's natural hinge axis points toward
 *     normalize(upper × forearm) in world space.
 *   - Elbow = pure 1DOF hinge around the bone-local Y axis (matches three-vrm
 *     normalized humanoid rest convention), magnitude = angle(upper, forearm).
 *
 * This recovers the upper-arm roll DOF that the old minimal-arc decomposition
 * threw away, and confines the elbow to a true hinge rather than smearing
 * the bend across three Euler axes.
 */
export function solveArmDirect(input: DirectArmInput): TwoBoneIKResult {
  const { shoulder, elbow, wrist, isLeft } = input

  const tposeDir: Vector3 = isLeft ? { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 }
  // Hinge axis in upper-arm-local frame. Mirrored across sides so symmetric
  // poses produce mirrored Eulers without a phantom 180° upper-arm twist.
  const hingeLocal: Vector3 = isLeft ? { x: 0, y: -1, z: 0 } : { x: 0, y: 1, z: 0 }

  const upperArmDir = sub(elbow, shoulder)
  const forearmDir = sub(wrist, elbow)
  const upperLen = length(upperArmDir)
  const forearmLen = length(forearmDir)

  if (upperLen < 0.001) {
    return { shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 }, reachable: true }
  }

  const u = normalize(upperArmDir)

  if (forearmLen < 0.001) {
    // No forearm info — fall back to 2DOF minimal-arc shoulder.
    return {
      shoulder: directionToEulerZYX(tposeDir, u),
      elbow: { x: 0, y: 0, z: 0 },
      reachable: true,
    }
  }

  const f = normalize(forearmDir)
  const cosBend = clamp(dot(u, f), -1, 1)
  const bendAngle = Math.acos(cosBend)

  const hingeWorld = cross(u, f)
  const hingeLen = length(hingeWorld)

  if (hingeLen < 0.01) {
    // Arm is (nearly) straight — no hinge plane defined; roll is ambiguous.
    // Use 2DOF minimal-arc and zero elbow flex.
    return {
      shoulder: directionToEulerZYX(tposeDir, u),
      elbow: { x: 0, y: 0, z: 0 },
      reachable: true,
    }
  }

  const nWorld: Vector3 = {
    x: hingeWorld.x / hingeLen,
    y: hingeWorld.y / hingeLen,
    z: hingeWorld.z / hingeLen,
  }

  const shoulderQuat = rotationFromTwoPairs(tposeDir, hingeLocal, u, nWorld)
  const shoulderEuler = quaternionToEulerZYX(shoulderQuat)

  // R_elbow = rotation by +bendAngle around hingeLocal.
  // hingeLocal points along ±Y, so this is a pure Y-axis rotation; the sign is
  // negative when hingeLocal = -Y (left arm), positive when +Y (right arm).
  const elbowY = isLeft ? -bendAngle : bendAngle

  return {
    shoulder: shoulderEuler,
    elbow: { x: 0, y: elbowY, z: 0 },
    reachable: true,
  }
}

/**
 * Clamp arm rotations to anatomical limits.
 * Prevents unnatural over-rotation that makes arms look broken.
 */
export function clampArmRotation(result: TwoBoneIKResult): TwoBoneIKResult {
  return {
    shoulder: {
      // Symmetric clamp — shoulder.x is now bone roll (around bone axis), which
      // is naturally signed. The old asymmetric [-π/2, π] reflected an anatomical
      // pitch interpretation that no longer applies after the 3DOF decomposition.
      x: clamp(result.shoulder.x, -Math.PI, Math.PI),
      y: clamp(result.shoulder.y, -Math.PI, Math.PI),
      z: clamp(result.shoulder.z, -Math.PI, Math.PI),
    },
    elbow: {
      x: clamp(result.elbow.x, -2.6, 2.6),
      y: clamp(result.elbow.y, -2.6, 2.6),
      z: clamp(result.elbow.z, -2.6, 2.6),
    },
    reachable: result.reachable,
  }
}
