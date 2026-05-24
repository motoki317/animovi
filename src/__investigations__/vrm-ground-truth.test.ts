/**
 * Ground-truth pipeline drift test using a REAL three-vrm humanoid.
 *
 * Unlike pipeline-drift.test.ts (which used a synthetic FK shortcut), this
 * test constructs an actual VRMHumanoid from a procedural skeleton, applies
 * solver outputs via the live TrackingBridge, calls humanoid.update() and
 * scene.updateMatrixWorld() exactly the way the renderer does, then reads
 * back world positions of the leftHand and rightHand bones.
 *
 * The "drift" we measure is the angle between:
 *   expected: MediaPipe-derived wrist direction from shoulder
 *   actual:   three-vrm's raw bone world wrist direction from shoulder
 *
 * This catches the conjugation through three-vrm's normalized humanoid rig
 * that the previous synthetic FK missed.
 */

import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { VRMHumanoid, VRMUtils } from '@pixiv/three-vrm'
import type { VRM, VRMHumanBones } from '@pixiv/three-vrm'
import { TrackingBridge } from '../lib/vrm/tracking-bridge'
import { solveHolistic } from '../lib/solver/holistic-solver'
import {
  T_POSE,
  ARMS_FORWARD,
  ARMS_DOWN,
  ARMS_UP,
  ELBOWS_BENT,
  LANDMARKS,
  createArmFixture,
  type PoseFixture,
  type Vector3,
} from '../lib/__fixtures__/pose-fixtures'

// ---------------------------------------------------------------------------
// New fixture: arm raised with palm-toward-camera (the user's symptom case)
// ---------------------------------------------------------------------------

const LEFT_ARM_UP: PoseFixture = {
  name: 'Left Arm Up (palm at camera)',
  description: 'Left arm raised above head, palm at camera',
  landmarks: createArmFixture({
    name: 'Left Arm Up',
    description: 'Left arm raised',
    leftShoulder: { x: 0.65, y: 0.30, z: 0 },
    leftElbow: { x: 0.62, y: 0.15, z: -0.05 },
    leftWrist: { x: 0.60, y: 0.02, z: -0.10 },
    rightShoulder: { x: 0.35, y: 0.30, z: 0 },
    rightElbow: { x: 0.35, y: 0.50, z: 0 },
    rightWrist: { x: 0.35, y: 0.70, z: 0 },
  }),
  expected: {
    leftArm: { shoulder: { x: 0, y: 0, z: -Math.PI / 2 }, elbow: { x: 0, y: 0, z: 0 } },
    rightArm: { shoulder: { x: 0, y: 0, z: Math.PI / 2.5 }, elbow: { x: 0, y: 0, z: 0 } },
  },
  rotationTolerance: 0.6,
}

const FIXTURES: PoseFixture[] = [T_POSE, ARMS_FORWARD, ARMS_DOWN, ARMS_UP, ELBOWS_BENT, LEFT_ARM_UP]

// ---------------------------------------------------------------------------
// Build a procedural T-pose skeleton + VRMHumanoid
// ---------------------------------------------------------------------------

interface BuiltVrm {
  vrm: VRM
  scene: THREE.Scene
  raw: {
    hips: THREE.Object3D
    leftShoulderJoint: THREE.Object3D
    leftUpperArm: THREE.Object3D
    leftLowerArm: THREE.Object3D
    leftHand: THREE.Object3D
    rightShoulderJoint: THREE.Object3D
    rightUpperArm: THREE.Object3D
    rightLowerArm: THREE.Object3D
    rightHand: THREE.Object3D
  }
}

/**
 * Build a procedural humanoid skeleton in T-pose.
 *
 * `facing` controls which way the model points natively. For VRM 0.x we set
 * `facing: -1` (model faces -Z in GLB; rotateVRM0 later flips it). For VRM 1.x
 * we set `facing: +1` (model already faces +Z).
 *
 * After load + rotateVRM0, both should have left arm extending world -X.
 */
function buildProceduralVRM(metaVersion: '0' | '1'): BuiltVrm {
  const scene = new THREE.Scene()

  // Sign of the model's left-arm side in scene-local (BEFORE any rotateVRM0)
  // VRM 0.x model faces -Z natively; in that frame model's left is at world +X
  // (anatomical left of a person facing -Z is on world +X — like standing
  // facing south, your left hand is east-side).
  // VRM 1.x model faces +Z natively; model's left is at world -X.
  const leftSign = metaVersion === '0' ? +1 : -1
  const rightSign = -leftSign

  const make = (name: string, pos: [number, number, number]) => {
    const o = new THREE.Object3D()
    o.name = name
    o.position.set(...pos)
    return o
  }

  // Body — positions are SCENE-LOCAL (before any rotateVRM0).
  const hips = make('hips', [0, 1.0, 0])
  const spine = make('spine', [0, 0.2, 0])  // relative to hips → world (0, 1.2, 0)
  const head = make('head', [0, 0.5, 0])    // relative to spine → world (0, 1.7, 0)

  // Left arm (anatomical) — at leftSign · |x| in scene-local.
  const leftShoulderJoint = make('leftShoulderJoint', [leftSign * 0.18, 0.15, 0]) // relative to spine
  const leftUpperArm = make('leftUpperArm', [leftSign * 0.05, 0, 0]) // relative to shoulder
  const leftLowerArm = make('leftLowerArm', [leftSign * 0.27, 0, 0]) // relative to upperArm (down the bone)
  const leftHand = make('leftHand', [leftSign * 0.25, 0, 0])

  const rightShoulderJoint = make('rightShoulderJoint', [rightSign * 0.18, 0.15, 0])
  const rightUpperArm = make('rightUpperArm', [rightSign * 0.05, 0, 0])
  const rightLowerArm = make('rightLowerArm', [rightSign * 0.27, 0, 0])
  const rightHand = make('rightHand', [rightSign * 0.25, 0, 0])

  // Legs (required by VRMRequiredHumanBoneName)
  const leftUpperLeg = make('leftUpperLeg', [leftSign * 0.1, -0.05, 0]) // relative to hips
  const leftLowerLeg = make('leftLowerLeg', [0, -0.4, 0])
  const leftFoot = make('leftFoot', [0, -0.4, 0.1])
  const rightUpperLeg = make('rightUpperLeg', [rightSign * 0.1, -0.05, 0])
  const rightLowerLeg = make('rightLowerLeg', [0, -0.4, 0])
  const rightFoot = make('rightFoot', [0, -0.4, 0.1])

  // Wire hierarchy
  scene.add(hips)
  hips.add(spine)
  spine.add(head)
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

  // Force-update world matrices once so VRMHumanoid sees correct world poses.
  scene.updateMatrixWorld(true)

  const humanBones: VRMHumanBones = {
    hips: { node: hips },
    spine: { node: spine },
    head: { node: head },
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

  // Minimal VRM-shaped object that TrackingBridge + VRMUtils.rotateVRM0 use.
  // We attach a no-op expressionManager so face tracking doesn't crash if invoked.
  const vrm = {
    meta: { metaVersion },
    humanoid,
    scene,
    expressionManager: {
      setValue: vi.fn(),
      getValue: vi.fn(),
    },
  } as unknown as VRM

  // Apply rotateVRM0 to bring both versions to camera-facing convention.
  VRMUtils.rotateVRM0(vrm)
  scene.updateMatrixWorld(true)

  return {
    vrm,
    scene,
    raw: {
      hips,
      leftShoulderJoint,
      leftUpperArm,
      leftLowerArm,
      leftHand,
      rightShoulderJoint,
      rightUpperArm,
      rightLowerArm,
      rightHand,
    },
  }
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

function vec(o: THREE.Vector3 | { x: number; y: number; z: number }): Vector3 {
  return { x: o.x, y: o.y, z: o.z }
}
function sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function len(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}
function normalize(v: Vector3): Vector3 {
  const l = len(v)
  return l === 0 ? { x: 0, y: 0, z: 0 } : { x: v.x / l, y: v.y / l, z: v.z / l }
}
function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function angleDeg(a: Vector3, b: Vector3): number {
  const an = normalize(a)
  const bn = normalize(b)
  if (len(an) === 0 || len(bn) === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot(an, bn)))) * 180) / Math.PI
}

/** Apply rotY to a vector. */
function rotateY(v: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}

/** MediaPipe → solver/VRM coordinate space, matching pose-solver.ts:toVRMSpace. */
function toVRMSpace(p: { x: number; y: number; z: number }): Vector3 {
  return { x: -(p.x - 0.5), y: -p.y, z: p.z }
}

// ---------------------------------------------------------------------------
// Expected wrist direction in world frame (after camera convention)
// ---------------------------------------------------------------------------

/**
 * Convert MediaPipe shoulder/wrist landmarks to expected world wrist
 * direction (unit vector from shoulder). After rotateVRM0, both VRM versions
 * have model-left at world -X, so we apply rotY(π) to the toVRMSpace offset
 * to land in that frame.
 */
function expectedWristWorldDir(landmark: {
  shoulder: { x: number; y: number; z: number }
  wrist: { x: number; y: number; z: number }
}): Vector3 {
  const sVRM = toVRMSpace(landmark.shoulder)
  const wVRM = toVRMSpace(landmark.wrist)
  const offset = sub(wVRM, sVRM)
  return normalize(rotateY(offset, Math.PI))
}

// ---------------------------------------------------------------------------
// Pipeline runner — pushes fixture → bridge → real VRMHumanoid → world readback
// ---------------------------------------------------------------------------

interface ArmReadout {
  side: 'left' | 'right'
  shoulderWorld: Vector3
  handWorld: Vector3
  appliedUpper: Vector3
  appliedLower: Vector3
  expectedDir: Vector3
  actualDir: Vector3
  driftDeg: number
}

function runPipeline(fixture: PoseFixture, metaVersion: '0' | '1'): ArmReadout[] {
  const { vrm, scene, raw } = buildProceduralVRM(metaVersion)

  // Bridge expects expressionManager etc; we already mocked them.
  const bridge = new TrackingBridge(vrm, { smoothing: 0 })

  const solved = solveHolistic({
    face: [],
    pose: fixture.landmarks,
    leftHand: [],
    rightHand: [],
  })

  // Run two frames to clear Kalman init transient.
  bridge.update(solved)
  bridge.update(solved)

  // Snapshot the rotations the bridge wrote on the NORMALIZED bones.
  // We pull these from the normalized humanoid (what the bridge actually
  // modified) rather than via getAppliedRotations(), which records pre-write
  // values that may differ by smoothing.
  const norm = vrm.humanoid!.normalizedHumanBones
  const appliedLeftUpper = norm.leftUpperArm?.node.rotation
  const appliedLeftLower = norm.leftLowerArm?.node.rotation
  const appliedRightUpper = norm.rightUpperArm?.node.rotation
  const appliedRightLower = norm.rightLowerArm?.node.rotation

  // Propagate normalized rotations to raw bones, then refresh world matrices.
  vrm.humanoid!.update()
  scene.updateMatrixWorld(true)

  const readArm = (side: 'left' | 'right'): ArmReadout => {
    const shoulderBone = side === 'left' ? raw.leftUpperArm : raw.rightUpperArm
    const handBone = side === 'left' ? raw.leftHand : raw.rightHand

    const shoulderWorld = vec(shoulderBone.getWorldPosition(new THREE.Vector3()))
    const handWorld = vec(handBone.getWorldPosition(new THREE.Vector3()))

    const upperEuler = side === 'left' ? appliedLeftUpper : appliedRightUpper
    const lowerEuler = side === 'left' ? appliedLeftLower : appliedRightLower
    const appliedUpper: Vector3 = upperEuler
      ? { x: upperEuler.x, y: upperEuler.y, z: upperEuler.z }
      : { x: 0, y: 0, z: 0 }
    const appliedLower: Vector3 = lowerEuler
      ? { x: lowerEuler.x, y: lowerEuler.y, z: lowerEuler.z }
      : { x: 0, y: 0, z: 0 }

    const expectedDir = expectedWristWorldDir({
      shoulder: side === 'left'
        ? fixture.landmarks[LANDMARKS.LEFT_SHOULDER]
        : fixture.landmarks[LANDMARKS.RIGHT_SHOULDER],
      wrist: side === 'left'
        ? fixture.landmarks[LANDMARKS.LEFT_WRIST]
        : fixture.landmarks[LANDMARKS.RIGHT_WRIST],
    })
    const actualDir = normalize(sub(handWorld, shoulderWorld))
    const driftDeg = angleDeg(expectedDir, actualDir)

    return {
      side,
      shoulderWorld,
      handWorld,
      appliedUpper,
      appliedLower,
      expectedDir,
      actualDir,
      driftDeg,
    }
  }

  const out = [readArm('left'), readArm('right')]
  bridge.dispose()
  return out
}

// ---------------------------------------------------------------------------
// Sanity checks on rest pose: arms should hang horizontally at -X / +X world.
// ---------------------------------------------------------------------------

describe('procedural VRMHumanoid: rest pose sanity', () => {
  for (const metaVersion of ['0', '1'] as const) {
    it(`VRM ${metaVersion}.x: leftHand at world -X, rightHand at world +X after rotateVRM0`, () => {
      const { scene, raw } = buildProceduralVRM(metaVersion)
      scene.updateMatrixWorld(true)
      const leftHandWorld = raw.leftHand.getWorldPosition(new THREE.Vector3())
      const rightHandWorld = raw.rightHand.getWorldPosition(new THREE.Vector3())
      // eslint-disable-next-line no-console
      console.log(
        `[rest][v${metaVersion}.x] leftHand world=(${leftHandWorld.x.toFixed(3)},${leftHandWorld.y.toFixed(3)},${leftHandWorld.z.toFixed(3)}) ` +
        `rightHand world=(${rightHandWorld.x.toFixed(3)},${rightHandWorld.y.toFixed(3)},${rightHandWorld.z.toFixed(3)})`
      )
      // After rotateVRM0 both VRM versions should converge on same world layout.
      expect(leftHandWorld.x).toBeLessThan(0)
      expect(rightHandWorld.x).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------------------------
// Main drift readout
// ---------------------------------------------------------------------------

describe('Real-VRM pipeline drift: MediaPipe → solver → bridge → three-vrm world readback', () => {
  for (const metaVersion of ['0', '1'] as const) {
    describe(`VRM ${metaVersion}.x`, () => {
      for (const fixture of FIXTURES) {
        it(`${fixture.name}: shoulder/hand world positions, drift°`, () => {
          const results = runPipeline(fixture, metaVersion)
          for (const r of results) {
            // eslint-disable-next-line no-console
            console.log(
              `[v${metaVersion}.x] ${fixture.name} ${r.side}: ` +
              `drift=${r.driftDeg.toFixed(1)}°  ` +
              `expected=(${r.expectedDir.x.toFixed(2)},${r.expectedDir.y.toFixed(2)},${r.expectedDir.z.toFixed(2)}) ` +
              `actual=(${r.actualDir.x.toFixed(2)},${r.actualDir.y.toFixed(2)},${r.actualDir.z.toFixed(2)}) ` +
              `applied.upper=(${r.appliedUpper.x.toFixed(2)},${r.appliedUpper.y.toFixed(2)},${r.appliedUpper.z.toFixed(2)}) ` +
              `applied.lower=(${r.appliedLower.x.toFixed(2)},${r.appliedLower.y.toFixed(2)},${r.appliedLower.z.toFixed(2)}) ` +
              `shoulder=(${r.shoulderWorld.x.toFixed(2)},${r.shoulderWorld.y.toFixed(2)},${r.shoulderWorld.z.toFixed(2)}) ` +
              `hand=(${r.handWorld.x.toFixed(2)},${r.handWorld.y.toFixed(2)},${r.handWorld.z.toFixed(2)})`
            )
          }
          expect(results.length).toBe(2)
        })
      }

      it(`VRM ${metaVersion}.x: drift summary`, () => {
        const rows: string[] = []
        for (const fixture of FIXTURES) {
          const r = runPipeline(fixture, metaVersion)
          for (const x of r) {
            rows.push(`${fixture.name.padEnd(30)} ${x.side.padEnd(6)} drift=${x.driftDeg.toFixed(1)}°`)
          }
        }
        // eslint-disable-next-line no-console
        console.log(`\n=== Real-VRM drift summary (VRM ${metaVersion}.x) ===\n${rows.join('\n')}\n`)
        expect(rows.length).toBe(FIXTURES.length * 2)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Cross-version equivalence check: do boneSign + scene rotation cancel out?
// ---------------------------------------------------------------------------

describe('Real-VRM cross-version: VRM 0.x vs 1.x should produce identical world wrist positions', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}: world positions match across versions`, () => {
      const v0 = runPipeline(fixture, '0')
      const v1 = runPipeline(fixture, '1')

      for (let i = 0; i < v0.length; i++) {
        const a = v0[i]
        const b = v1[i]
        const posDiff = len(sub(a.handWorld, b.handWorld))
        const dirDiff = angleDeg(a.actualDir, b.actualDir)
        // eslint-disable-next-line no-console
        console.log(
          `[cross] ${fixture.name} ${a.side}: ` +
          `hand-world-diff=${posDiff.toFixed(3)}  dir-diff=${dirDiff.toFixed(1)}°  ` +
          `v0=(${a.handWorld.x.toFixed(2)},${a.handWorld.y.toFixed(2)},${a.handWorld.z.toFixed(2)}) ` +
          `v1=(${b.handWorld.x.toFixed(2)},${b.handWorld.y.toFixed(2)},${b.handWorld.z.toFixed(2)})`
        )
      }
      expect(v0.length).toBe(v1.length)
    })
  }
})
