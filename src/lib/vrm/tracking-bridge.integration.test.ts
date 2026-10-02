/**
 * End-to-end motion checks against a real three-vrm humanoid. Each fixture runs
 * through solveHolistic, TrackingBridge, and a VRMHumanoid built from a
 * procedural T-pose skeleton. The test then reads the world positions of the
 * raw bones, which is what the renderer draws.
 *
 * Drift is the angle, in world space, between the shoulder→wrist direction
 * from the landmarks and the shoulder→hand direction of the raw bones.
 */

import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { VRMExpression, VRMExpressionManager, VRMHumanoid, VRMUtils } from '@pixiv/three-vrm'
import type { VRM, VRMHumanBones } from '@pixiv/three-vrm'
import { TrackingBridge } from './tracking-bridge'
import { solveHolistic, type HolisticLandmarks } from '../solver/holistic-solver'
import { toSolverSpace } from '../solver/pose-solver'
import { dot, length, normalize, sub, type Vector3 } from '../math/vector'
import {
  T_POSE,
  ARMS_FORWARD,
  ARMS_DOWN,
  ARMS_UP,
  ELBOWS_BENT,
  LANDMARKS,
  createArmFixture,
  type PoseFixture,
} from '../__fixtures__/pose-fixtures'

const LEFT_ARM_UP: PoseFixture = {
  name: 'Left Arm Up (palm at camera)',
  landmarks: createArmFixture({
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    leftElbow: { x: 0.62, y: 0.15, z: -0.05 },
    leftWrist: { x: 0.60, y: 0.02, z: -0.10 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    rightElbow: { x: 0.35, y: 0.50, z: 0 },
    rightWrist: { x: 0.35, y: 0.70, z: 0 },
  }),
}

const FIXTURES: PoseFixture[] = [T_POSE, ARMS_FORWARD, ARMS_DOWN, ARMS_UP, ELBOWS_BENT, LEFT_ARM_UP]

// Straight arms read 0.0°. A bent arm keeps up to 0.5°, because the rig's upper
// arm and forearm (0.27 and 0.25) have another length ratio than the fixture's.
const DRIFT_TOLERANCE_DEG = 1

interface BuiltVrm {
  vrm: VRM
  scene: THREE.Scene
  raw: {
    spine: THREE.Object3D
    head: THREE.Object3D
    leftEye: THREE.Object3D
    rightEye: THREE.Object3D
    leftUpperArm: THREE.Object3D
    leftHand: THREE.Object3D
    rightUpperArm: THREE.Object3D
    rightHand: THREE.Object3D
  }
}

/**
 * Builds a procedural T-pose skeleton and its VRMHumanoid. A VRM 0.x model
 * faces -Z in its file, so its left arm points to -X. A VRM 1.x model faces +Z,
 * so its left arm points to +X. After rotateVRM0, both face +Z with the left
 * arm at world +X.
 */
function buildProceduralVRM(metaVersion: '0' | '1'): BuiltVrm {
  const scene = new THREE.Scene()

  const leftSign = metaVersion === '0' ? -1 : +1
  const rightSign = -leftSign

  const make = (name: string, pos: [number, number, number]) => {
    const o = new THREE.Object3D()
    o.name = name
    o.position.set(...pos)
    return o
  }

  const hips = make('hips', [0, 1.0, 0])
  const spine = make('spine', [0, 0.2, 0])
  const head = make('head', [0, 0.5, 0])
  const leftEye = make('leftEye', [leftSign * 0.04, 0.06, leftSign * 0.08])
  const rightEye = make('rightEye', [rightSign * 0.04, 0.06, leftSign * 0.08])

  const leftShoulderJoint = make('leftShoulderJoint', [leftSign * 0.18, 0.15, 0])
  const leftUpperArm = make('leftUpperArm', [leftSign * 0.05, 0, 0])
  const leftLowerArm = make('leftLowerArm', [leftSign * 0.27, 0, 0])
  const leftHand = make('leftHand', [leftSign * 0.25, 0, 0])

  const rightShoulderJoint = make('rightShoulderJoint', [rightSign * 0.18, 0.15, 0])
  const rightUpperArm = make('rightUpperArm', [rightSign * 0.05, 0, 0])
  const rightLowerArm = make('rightLowerArm', [rightSign * 0.27, 0, 0])
  const rightHand = make('rightHand', [rightSign * 0.25, 0, 0])

  // VRMRequiredHumanBoneName includes the legs.
  const leftUpperLeg = make('leftUpperLeg', [leftSign * 0.1, -0.05, 0])
  const leftLowerLeg = make('leftLowerLeg', [0, -0.4, 0])
  const leftFoot = make('leftFoot', [0, -0.4, 0.1])
  const rightUpperLeg = make('rightUpperLeg', [rightSign * 0.1, -0.05, 0])
  const rightLowerLeg = make('rightLowerLeg', [0, -0.4, 0])
  const rightFoot = make('rightFoot', [0, -0.4, 0.1])

  scene.add(hips)
  hips.add(spine)
  spine.add(head)
  head.add(leftEye, rightEye)
  spine.add(leftShoulderJoint)
  leftShoulderJoint.add(leftUpperArm)
  leftUpperArm.add(leftLowerArm)
  leftLowerArm.add(leftHand)
  spine.add(rightShoulderJoint)
  rightShoulderJoint.add(rightUpperArm)
  rightUpperArm.add(rightLowerArm)
  rightLowerArm.add(rightHand)
  hips.add(leftUpperLeg)
  leftUpperLeg.add(leftLowerLeg)
  leftLowerLeg.add(leftFoot)
  hips.add(rightUpperLeg)
  rightUpperLeg.add(rightLowerLeg)
  rightLowerLeg.add(rightFoot)

  // Update world matrices before VRMHumanoid reads the rest pose.
  scene.updateMatrixWorld(true)

  const humanBones: VRMHumanBones = {
    hips: { node: hips },
    spine: { node: spine },
    head: { node: head },
    leftEye: { node: leftEye },
    rightEye: { node: rightEye },
    leftUpperArm: { node: leftUpperArm },
    leftLowerArm: { node: leftLowerArm },
    leftHand: { node: leftHand },
    rightUpperArm: { node: rightUpperArm },
    rightLowerArm: { node: rightLowerArm },
    rightHand: { node: rightHand },
    leftUpperLeg: { node: leftUpperLeg },
    leftLowerLeg: { node: leftLowerLeg },
    leftFoot: { node: leftFoot },
    rightUpperLeg: { node: rightUpperLeg },
    rightLowerLeg: { node: rightLowerLeg },
    rightFoot: { node: rightFoot },
  }

  const humanoid = new VRMHumanoid(humanBones)
  scene.add(humanoid.normalizedHumanBonesRoot)

  // The minimal VRM shape that TrackingBridge and rotateVRM0 read.
  const expressionManager = new VRMExpressionManager()
  expressionManager.registerExpression(new VRMExpression('blinkLeft'))
  expressionManager.registerExpression(new VRMExpression('blinkRight'))
  const vrm = {
    meta: { metaVersion },
    humanoid,
    scene,
    expressionManager,
  } as unknown as VRM

  VRMUtils.rotateVRM0(vrm)
  scene.updateMatrixWorld(true)

  return { vrm, scene, raw: { spine, head, leftEye, rightEye, leftUpperArm, leftHand, rightUpperArm, rightHand } }
}

function vec(o: THREE.Vector3 | { x: number; y: number; z: number }): Vector3 {
  return { x: o.x, y: o.y, z: o.z }
}
function angleDeg(a: Vector3, b: Vector3): number {
  const an = normalize(a)
  const bn = normalize(b)
  if (length(an) === 0 || length(bn) === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot(an, bn)))) * 180) / Math.PI
}
function rotateY(v: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}
function fmt(v: Vector3): string {
  return `(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`
}

/**
 * Shoulder→wrist unit direction in world space. Solver space is the VRM 0.x
 * file frame, and rotateVRM0 turns that frame π about Y into the world.
 */
function expectedWristWorldDir(landmark: {
  shoulder: { x: number; y: number; z: number }
  wrist: { x: number; y: number; z: number }
}): Vector3 {
  const offset = sub(toSolverSpace(landmark.wrist), toSolverSpace(landmark.shoulder))
  return normalize(rotateY(offset, Math.PI))
}

interface ArmReadout {
  side: 'left' | 'right'
  handWorld: Vector3
  appliedUpper: Vector3
  appliedLower: Vector3
  expectedDir: Vector3
  actualDir: Vector3
  driftDeg: number
}

function describeReadout(r: ArmReadout): string {
  return (
    `${r.side}: drift=${r.driftDeg.toFixed(1)}° expected=${fmt(r.expectedDir)} actual=${fmt(r.actualDir)} ` +
    `applied.upper=${fmt(r.appliedUpper)} applied.lower=${fmt(r.appliedLower)}`
  )
}

function runPipeline(fixture: PoseFixture, metaVersion: '0' | '1'): ArmReadout[] {
  const { vrm, scene, raw } = buildProceduralVRM(metaVersion)
  const bridge = new TrackingBridge(vrm, { smoothing: 0 })

  bridge.update(solveHolistic({
    face: [],
    pose: fixture.landmarks,
    leftHand: [],
    rightHand: [],
  }))

  const norm = vrm.humanoid!.normalizedHumanBones
  const appliedEuler = (bone: THREE.Object3D | undefined): Vector3 =>
    bone ? vec(bone.rotation) : { x: 0, y: 0, z: 0 }

  // humanoid.update() copies the normalized rotations to the raw bones.
  vrm.humanoid!.update()
  scene.updateMatrixWorld(true)

  const readArm = (side: 'left' | 'right'): ArmReadout => {
    const shoulderBone = side === 'left' ? raw.leftUpperArm : raw.rightUpperArm
    const handBone = side === 'left' ? raw.leftHand : raw.rightHand
    const shoulderWorld = vec(shoulderBone.getWorldPosition(new THREE.Vector3()))
    const handWorld = vec(handBone.getWorldPosition(new THREE.Vector3()))

    const expectedDir = expectedWristWorldDir({
      shoulder: fixture.landmarks[side === 'left' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER],
      wrist: fixture.landmarks[side === 'left' ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST],
    })
    const actualDir = normalize(sub(handWorld, shoulderWorld))

    return {
      side,
      handWorld,
      appliedUpper: appliedEuler(side === 'left' ? norm.leftUpperArm?.node : norm.rightUpperArm?.node),
      appliedLower: appliedEuler(side === 'left' ? norm.leftLowerArm?.node : norm.rightLowerArm?.node),
      expectedDir,
      actualDir,
      driftDeg: angleDeg(expectedDir, actualDir),
    }
  }

  const out = [readArm('left'), readArm('right')]
  bridge.dispose()
  return out
}

describe('procedural VRMHumanoid: rest pose sanity', () => {
  for (const metaVersion of ['0', '1'] as const) {
    it(`VRM ${metaVersion}.x: leftHand at world +X, rightHand at world -X after rotateVRM0`, () => {
      const { raw } = buildProceduralVRM(metaVersion)
      expect(raw.leftHand.getWorldPosition(new THREE.Vector3()).x).toBeGreaterThan(0)
      expect(raw.rightHand.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(0)
    })
  }
})

describe('Real-VRM pipeline drift: MediaPipe → solver → bridge → three-vrm world readback', () => {
  for (const metaVersion of ['0', '1'] as const) {
    describe(`VRM ${metaVersion}.x`, () => {
      for (const fixture of FIXTURES) {
        it(`${fixture.name}: hand direction matches the landmarks`, () => {
          for (const r of runPipeline(fixture, metaVersion)) {
            expect(r.driftDeg, describeReadout(r)).toBeLessThan(DRIFT_TOLERANCE_DEG)
          }
        })
      }
    })
  }
})

describe('Real-VRM cross-version: VRM 0.x vs 1.x should produce identical world wrist positions', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}: world positions match across versions`, () => {
      const v0 = runPipeline(fixture, '0')
      const v1 = runPipeline(fixture, '1')

      for (let i = 0; i < v0.length; i++) {
        expect(length(sub(v0[i].handWorld, v1[i].handWorld)), `${v0[i].side} hand`).toBeLessThan(1e-6)
      }
    })
  }
})

function neutralLandmarks(): HolisticLandmarks {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  for (const [outer, inner, upper, lower, iris, x] of [
    [33, 133, 159, 145, 468, 0.37],
    [263, 362, 386, 374, 473, 0.63],
  ]) {
    face[outer] = { x: x < 0.5 ? x - 0.05 : x + 0.05, y: 0.42, z: 0 }
    face[inner] = { x: x < 0.5 ? x + 0.05 : x - 0.05, y: 0.42, z: 0 }
    face[upper] = { x, y: 0.4, z: 0 }
    face[lower] = { x, y: 0.44, z: 0 }
    face[iris] = { x, y: 0.42, z: 0 }
  }
  return { face, pose: [], leftHand: [], rightHand: [] }
}

type DirectionReadout = 'headForwardX' | 'spineForwardX' | 'spineUpX' | 'headUpX' | 'eyesForwardX' | 'headForwardY' | 'eyesForwardY'
const SAME_SIDE_MOTIONS: Array<{
  name: string
  move: (landmarks: HolisticLandmarks) => void
  readout: DirectionReadout | 'leftArm' | 'leftBlink'
  sign?: number
}> = [
  { name: 'turns their head right', move: ({ face }) => { face[1].x = 0.3 }, readout: 'headForwardX', sign: -1 },
  { name: 'turns their body right (world landmarks)', move: (landmarks) => {
    landmarks.pose = structuredClone(T_POSE.landmarks)
    landmarks.poseWorld = structuredClone(T_POSE.landmarks)
    landmarks.poseWorld[11] = { x: 0.16, y: 0, z: -0.1 }
    landmarks.poseWorld[12] = { x: -0.16, y: 0, z: 0.1 }
  }, readout: 'spineForwardX', sign: -1 },
  { name: 'turns their body right (normalized fallback)', move: (landmarks) => {
    landmarks.pose = structuredClone(T_POSE.landmarks)
    landmarks.pose[11].z = -0.05
    landmarks.pose[12].z = 0.05
  }, readout: 'spineForwardX', sign: -1 },
  { name: 'leans right', move: (landmarks) => {
    landmarks.pose = structuredClone(T_POSE.landmarks)
    landmarks.pose[11].y = 0.25
    landmarks.pose[12].y = 0.35
  }, readout: 'spineUpX', sign: -1 },
  { name: 'tilts their head right', move: ({ face }) => {
    face[33].y = 0.47
    face[263].y = 0.37
  }, readout: 'headUpX', sign: -1 },
  { name: 'looks right', move: ({ face }) => {
    face[468].x -= 0.03
    face[473].x -= 0.03
  }, readout: 'eyesForwardX', sign: -1 },
  { name: 'tilts their head back', move: ({ face }) => {
    face[10].z = 0.03
    face[152].z = -0.02
  }, readout: 'headForwardY', sign: 1 },
  { name: 'looks up', move: ({ face }) => {
    face[468].y -= 0.01
    face[473].y -= 0.01
  }, readout: 'eyesForwardY', sign: 1 },
  { name: 'raises their left arm', move: (landmarks) => {
    landmarks.pose = structuredClone(LEFT_ARM_UP.landmarks)
  }, readout: 'leftArm' },
  { name: 'closes their left eye', move: ({ face }) => { face[374].y = face[386].y }, readout: 'leftBlink' },
]

describe.each(['0', '1'] as const)('Same-side landmarks → world space: VRM %s.x', (metaVersion) => {
  it.each(SAME_SIDE_MOTIONS)('user $name', ({ move, readout, sign }) => {
    const { vrm, scene, raw } = buildProceduralVRM(metaVersion)
    const landmarks = neutralLandmarks()
    move(landmarks)
    const bridge = new TrackingBridge(vrm, { smoothing: 0 })

    bridge.update(solveHolistic(landmarks))
    vrm.humanoid.update()
    scene.updateMatrixWorld(true)

    const forward = (bone: THREE.Object3D) => new THREE.Vector3(0, 0, metaVersion === '0' ? -1 : 1)
      .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()))
    const up = (bone: THREE.Object3D) => new THREE.Vector3(0, 1, 0)
      .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()))
    const directions: Record<DirectionReadout, number[]> = {
      headForwardX: [forward(raw.head).x],
      spineForwardX: [forward(raw.spine).x],
      spineUpX: [up(raw.spine).x],
      headUpX: [up(raw.head).x],
      eyesForwardX: [forward(raw.leftEye).x, forward(raw.rightEye).x],
      headForwardY: [forward(raw.head).y],
      eyesForwardY: [forward(raw.leftEye).y, forward(raw.rightEye).y],
    }
    if (readout === 'leftArm') {
      const left = raw.leftHand.getWorldPosition(new THREE.Vector3())
      const right = raw.rightHand.getWorldPosition(new THREE.Vector3())
      expect(left.x).toBeGreaterThan(0)
      expect(left.y).toBeGreaterThan(raw.leftUpperArm.getWorldPosition(new THREE.Vector3()).y)
      expect(right.y).toBeLessThan(raw.rightUpperArm.getWorldPosition(new THREE.Vector3()).y)
    } else if (readout === 'leftBlink') {
      expect(vrm.expressionManager!.getValue('blinkLeft')).toBe(1)
      expect(vrm.expressionManager!.getValue('blinkRight')).toBe(0)
    } else {
      for (const component of directions[readout]) expect(component * sign!).toBeGreaterThan(0.1)
    }
    bridge.dispose()
  })
})
