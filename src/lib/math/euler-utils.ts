/**
 * Euler angle utilities for VRM bone rotations.
 */

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface Euler {
  x: number
  y: number
  z: number
}

/**
 * Convert quaternion to euler angles (XYZ order, radians).
 */
export function quaternionToEuler(q: Quaternion): Euler {
  const { x, y, z, w } = q

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z)
  const cosr_cosp = 1 - 2 * (x * x + y * y)
  const roll = Math.atan2(sinr_cosp, cosr_cosp)

  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x)
  const pitch = Math.abs(sinp) >= 1
    ? Math.sign(sinp) * Math.PI / 2
    : Math.asin(sinp)

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y)
  const cosy_cosp = 1 - 2 * (y * y + z * z)
  const yaw = Math.atan2(siny_cosp, cosy_cosp)

  return { x: roll, y: pitch, z: yaw }
}
