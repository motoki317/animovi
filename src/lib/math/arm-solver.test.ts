import { describe, it, expect } from 'vitest'
import { solveArmDirect, clampArmRotation } from './arm-solver'
import { dot, normalize, type Vector3 } from './vector'

/** Rotates v by Euler angles in three.js order 'ZYX': Rz · Ry · Rx · v. */
function applyEulerZYX(v: Vector3, x: number, y: number, z: number): Vector3 {
  const cosX = Math.cos(x), sinX = Math.sin(x)
  const cosY = Math.cos(y), sinY = Math.sin(y)
  const cosZ = Math.cos(z), sinZ = Math.sin(z)

  const x1 = v.x
  const y1 = v.y * cosX - v.z * sinX
  const z1 = v.y * sinX + v.z * cosX

  const x2 = x1 * cosY + z1 * sinY
  const y2 = y1
  const z2 = -x1 * sinY + z1 * cosY

  const x3 = x2 * cosZ - y2 * sinZ
  const y3 = x2 * sinZ + y2 * cosZ

  return { x: x3, y: y3, z: z2 }
}

/**
 * The elbow rotation is local to the upper arm, so the bone chain gives the
 * forearm direction R_shoulder · R_elbow · tposeDir.
 */
function boneHierarchyForearmDir(tposeDir: Vector3, shoulderRot: Vector3, elbowRot: Vector3): Vector3 {
  const localResult = applyEulerZYX(tposeDir, elbowRot.x, elbowRot.y, elbowRot.z)
  return applyEulerZYX(localResult, shoulderRot.x, shoulderRot.y, shoulderRot.z)
}

const LEFT_TPOSE: Vector3 = { x: -1, y: 0, z: 0 }
const RIGHT_TPOSE: Vector3 = { x: 1, y: 0, z: 0 }

describe('solveArmDirect - shoulder and elbow angles', () => {
  it('should compute correct shoulder rotation for arm pointing forward', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: -1 },
      wrist: { x: 0, y: 0, z: -2 },
      isLeft: true,
    })

    // From the left rest direction (-X) to forward (-Z) is -90° about Y.
    expect(result.shoulder.y).toBeCloseTo(-Math.PI / 2, 1)
    expect(result.elbow.y).toBeCloseTo(0, 1)
  })

  it('should compute correct shoulder rotation for arm pointing down', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -2, z: 0 },
      isLeft: true,
    })

    expect(result.shoulder.z).toBeCloseTo(Math.PI / 2, 1)
    expect(result.elbow.y).toBeCloseTo(0, 1)
  })

  it('should compute elbow bend for bent arm', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -1, z: -1 },
      isLeft: true,
    })

    // A 90° bend on the left arm, whose hinge axis is -Y.
    expect(result.elbow.y).toBeCloseTo(-Math.PI / 2, 1)
  })

  it('should handle right arm mirroring correctly', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: -1 },
      wrist: { x: 0, y: 0, z: -2 },
      isLeft: false,
    })

    expect(result.shoulder.y).toBeCloseTo(Math.PI / 2, 1)
  })
})

describe('solveArmDirect - forearm direction through the bone chain', () => {
  it('should produce identity elbow rotation when arm is straight', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -2, z: 0 },
      isLeft: true,
    })

    expect(Math.abs(result.elbow.x)).toBeLessThan(0.1)
    expect(Math.abs(result.elbow.y)).toBeLessThan(0.1)
    expect(Math.abs(result.elbow.z)).toBeLessThan(0.1)
  })

  it('should produce correct elbow rotation when forearm bends forward from downward upper arm', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -1, z: -1 },
      isLeft: true,
    })

    const forearmWorldDir = boneHierarchyForearmDir(LEFT_TPOSE, result.shoulder, result.elbow)

    expect(dot(normalize(forearmWorldDir), { x: 0, y: 0, z: -1 })).toBeGreaterThan(0.9)
  })

  it('should produce correct elbow rotation when forearm bends inward', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: -1, y: 0, z: 0 },
      wrist: { x: -1, y: -1, z: 0 },
      isLeft: true,
    })

    const forearmWorldDir = boneHierarchyForearmDir(LEFT_TPOSE, result.shoulder, result.elbow)

    expect(dot(normalize(forearmWorldDir), { x: 0, y: -1, z: 0 })).toBeGreaterThan(0.9)
  })

  it('should produce correct end-to-end arm direction using both shoulder and elbow rotations', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: -1, z: 0 },
      wrist: { x: 0, y: -1, z: -1 },
      isLeft: true,
    })

    const upperArmResult = applyEulerZYX(LEFT_TPOSE, result.shoulder.x, result.shoulder.y, result.shoulder.z)
    expect(upperArmResult.y).toBeLessThan(-0.8)

    const forearmResult = boneHierarchyForearmDir(LEFT_TPOSE, result.shoulder, result.elbow)
    expect(forearmResult.z).toBeLessThan(-0.8)
  })
})

// With a large shoulder rotation, an elbow rotation applied in world space
// instead of the upper arm's local space points the forearm the wrong way.
describe('Elbow rotation in parent-local space - bone hierarchy FK', () => {
  it('left arm raised up + forearm pointing forward: bone FK should match target direction', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 1, z: 0 },
      wrist: { x: 0, y: 1, z: -1 },
      isLeft: true,
    })

    const forearmNorm = normalize(boneHierarchyForearmDir(LEFT_TPOSE, result.shoulder, result.elbow))

    // A dot product above 0.8 puts the directions within about 37°.
    expect(dot(forearmNorm, { x: 0, y: 0, z: -1 })).toBeGreaterThan(0.8)
  })

  it('left arm pointing forward + forearm bending down: bone FK should match target direction', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 0, z: -1 },
      wrist: { x: 0, y: -1, z: -1 },
      isLeft: true,
    })

    const forearmNorm = normalize(boneHierarchyForearmDir(LEFT_TPOSE, result.shoulder, result.elbow))

    expect(dot(forearmNorm, { x: 0, y: -1, z: 0 })).toBeGreaterThan(0.8)
  })

  it('right arm raised up + forearm pointing forward: bone FK should match target direction', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: 0, y: 1, z: 0 },
      wrist: { x: 0, y: 1, z: -1 },
      isLeft: false,
    })

    const forearmNorm = normalize(boneHierarchyForearmDir(RIGHT_TPOSE, result.shoulder, result.elbow))

    expect(dot(forearmNorm, { x: 0, y: 0, z: -1 })).toBeGreaterThan(0.8)
  })

  it('left arm raised diagonally + forearm bending inward: bone FK should match target direction', () => {
    const result = solveArmDirect({
      shoulder: { x: 0, y: 0, z: 0 },
      elbow: { x: -0.3, y: 1, z: -0.3 },
      wrist: { x: -0.3, y: 1.7, z: -0.8 },
      isLeft: true,
    })

    const forearmNorm = normalize(boneHierarchyForearmDir(LEFT_TPOSE, result.shoulder, result.elbow))

    expect(dot(forearmNorm, normalize({ x: 0, y: 0.7, z: -0.5 }))).toBeGreaterThan(0.8)
  })
})

describe('clampArmRotation', () => {
  it('should pass through rotations within anatomical limits', () => {
    const result = clampArmRotation({
      shoulder: { x: 0.5, y: 0.3, z: -0.2 },
      elbow: { x: 0, y: -0.8, z: 0 },
    })

    expect(result.shoulder.x).toBeCloseTo(0.5)
    expect(result.shoulder.y).toBeCloseTo(0.3)
    expect(result.shoulder.z).toBeCloseTo(-0.2)
    expect(result.elbow.y).toBeCloseTo(-0.8)
  })

  it('limits elbow flexion to 2.6 rad on either side', () => {
    const left = clampArmRotation({ shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: -3.5, z: 0 } })
    const right = clampArmRotation({ shoulder: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 3.5, z: 0 } })

    expect(left.elbow.y).toBeCloseTo(-2.6)
    expect(right.elbow.y).toBeCloseTo(2.6)
  })
})
