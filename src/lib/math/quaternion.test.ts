import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  eulerZYXToQuat,
  quaternionToEulerZYX,
  quatMul,
  rotationFromTwoPairs,
  type Quat,
} from './quaternion'
import type { Vector3 } from './vector'

// three.js applies these rotations to the bones, so it is the reference.
const toThree = (q: Quat) => new THREE.Quaternion(q[0], q[1], q[2], q[3])

function expectSameRotation(actual: Quat, expected: THREE.Quaternion) {
  // q and -q are the same rotation.
  expect(Math.abs(toThree(actual).dot(expected))).toBeCloseTo(1, 9)
}

function rotate(q: Quat, v: Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z).applyQuaternion(toThree(q))
}

const EULERS = [
  { x: 0.3, y: -0.7, z: 1.1 },
  { x: -2.5, y: 0.4, z: -0.2 },
  { x: 1.2, y: 1.3, z: 2.9 },
]

describe('eulerZYXToQuat', () => {
  it.each(EULERS)('matches three.js for order ZYX at %o', (e) => {
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x, e.y, e.z, 'ZYX'))
    expectSameRotation(eulerZYXToQuat(e), expected)
  })
})

describe('quaternionToEulerZYX', () => {
  it.each(EULERS)('inverts eulerZYXToQuat at %o', (e) => {
    const back = quaternionToEulerZYX(eulerZYXToQuat(e))
    expect(back.x).toBeCloseTo(e.x, 9)
    expect(back.y).toBeCloseTo(e.y, 9)
    expect(back.z).toBeCloseTo(e.z, 9)
  })

  it('returns a rotation equal to the input at gimbal lock (y = π/2)', () => {
    const q = eulerZYXToQuat({ x: 0.4, y: Math.PI / 2, z: 0.9 })
    const e = quaternionToEulerZYX(q)

    expect(e.y).toBeCloseTo(Math.PI / 2, 6)
    expectSameRotation(eulerZYXToQuat(e), toThree(q))
  })
})

describe('quatMul', () => {
  it('matches three.js multiplyQuaternions, so the right operand applies first', () => {
    const a = eulerZYXToQuat(EULERS[0])
    const b = eulerZYXToQuat(EULERS[1])
    const expected = new THREE.Quaternion().multiplyQuaternions(toThree(a), toThree(b))
    expectSameRotation(quatMul(a, b), expected)
  })
})

describe('rotationFromTwoPairs', () => {
  const uLocal = { x: -1, y: 0, z: 0 }
  const nLocal = { x: 0, y: -1, z: 0 }

  // The second case is a half turn about Z. Its matrix trace is -1, so it takes
  // a non-trace branch of the matrix-to-quaternion conversion.
  it.each([
    { name: 'a general rotation', q: eulerZYXToQuat({ x: 0.5, y: -1, z: 2 }) },
    { name: 'a half turn', q: [0, 0, 1, 0] as Quat },
    { name: 'the identity', q: [0, 0, 0, 1] as Quat },
  ])('maps both local axes onto their world axes for $name', ({ q }) => {
    const uWorld = rotate(q, uLocal)
    const nWorld = rotate(q, nLocal)

    const r = rotationFromTwoPairs(uLocal, nLocal, uWorld, nWorld)

    expect(rotate(r, uLocal).distanceTo(uWorld)).toBeLessThan(1e-9)
    expect(rotate(r, nLocal).distanceTo(nWorld)).toBeLessThan(1e-9)
  })
})
